import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { emailQueue } from '../queue/emailQueue';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import { indexEmail, searchEmails } from '../lib/elasticsearch';
import { getSenderEmails } from '../services/emailService';
import { config } from '../config';

const router = Router();

// All routes require auth
router.use(authMiddleware);

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const {
      subject,
      body,
      recipients,
      startTime,
      delayBetweenSeconds,
      hourlyLimit,
      sender,
    } = req.body as {
      subject: string;
      body: string;
      recipients: string[];
      startTime: string;
      delayBetweenSeconds: number;
      hourlyLimit?: number;
      sender?: string;
    };

    // Validation
    if (!subject || !body || !recipients?.length || !startTime) {
      res.status(400).json({
        error: 'Missing required fields: subject, body, recipients, startTime',
      });
      return;
    }

    const userId = getAuthUser(req).id;
    const senderEmails = getSenderEmails();

    if (senderEmails.length === 0) {
      res.status(500).json({ error: 'No sender accounts configured' });
      return;
    }

    // Pick sender: use provided sender or round-robin
    const selectedSender = sender && senderEmails.includes(sender)
      ? sender
      : senderEmails[0];

    const startMs = new Date(startTime).getTime();
    const delayMs = (delayBetweenSeconds || 0) * 1000;

    // Create emails in DB and queue jobs
    const emails = [];
    const jobs = [];

    for (let i = 0; i < recipients.length; i++) {
      const emailId = uuidv4();
      const scheduledAt = new Date(startMs + i * delayMs);

      // Assign sender in round-robin fashion for multiple senders
      const assignedSender = senderEmails.length > 1
        ? senderEmails[i % senderEmails.length]
        : selectedSender;

      emails.push({
        id: emailId,
        userId,
        sender: assignedSender,
        recipient: recipients[i],
        subject,
        body,
        status: 'SCHEDULED' as const,
        scheduledAt,
      });

      const jobDelay = Math.max(scheduledAt.getTime() - Date.now(), 0);

      jobs.push({
        name: 'send-email',
        data: {
          emailId,
          sender: assignedSender,
          recipient: recipients[i],
          subject,
          body,
          userId,
          hourlyLimit: hourlyLimit || config.maxEmailsPerHourPerSender,
        },
        opts: {
          jobId: emailId, // Idempotency: same email can never be queued twice
          delay: jobDelay,
        },
      });
    }

    // Batch insert into DB
    await prisma.email.createMany({ data: emails });

    // Batch add to queue
    await emailQueue.addBulk(jobs);

    // Index in Elasticsearch (fire and forget, don't block response)
    Promise.all(
      emails.map((e) =>
        indexEmail({
          emailId: e.id,
          recipient: e.recipient,
          sender: e.sender,
          subject: e.subject,
          body: e.body,
          status: e.status,
          scheduledAt: e.scheduledAt.toISOString(),
          userId: e.userId,
        }).catch((err: unknown) => console.error('[ES] Index error:', err))
      )
    );

    res.json({
      message: `Scheduled ${emails.length} emails`,
      count: emails.length,
      emailIds: emails.map((e) => e.id),
    });
  } catch (err) {
    console.error('[Schedule] Error:', err);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

/**
 * GET /api/emails/scheduled
 * List scheduled emails for the current user
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req).id;
    const emails = await prisma.email.findMany({
      where: { userId, status: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
    res.json(emails);
  } catch (err) {
    console.error('[Scheduled] Error:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * List sent and failed emails for the current user
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req).id;
    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: { in: ['SENT', 'FAILED'] },
      },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });
    res.json(emails);
  } catch (err) {
    console.error('[Sent] Error:', err);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

/**
 * GET /api/emails/search
 * Full-text search via Elasticsearch
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, status } = req.query as { q?: string; status?: string };
    const userId = getAuthUser(req).id;

    const results = await searchEmails(q || '', status, userId);
    res.json(results);
  } catch (err) {
    console.error('[Search] Error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/emails/senders
 * Get list of available sender accounts
 */
router.get('/senders', async (_req: Request, res: Response) => {
  const senders = getSenderEmails();
  res.json(senders);
});

/**
 * GET /api/emails/stats
 * Get email counts for the current user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req).id;

    const [scheduledCount, sentCount] = await Promise.all([
      prisma.email.count({ where: { userId, status: 'SCHEDULED' } }),
      prisma.email.count({ where: { userId, status: { in: ['SENT', 'FAILED'] } } }),
    ]);

    res.json({ scheduled: scheduledCount, sent: sentCount });
  } catch (err) {
    console.error('[Stats] Error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
