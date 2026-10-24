import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { config } from './config';
import prisma from './lib/prisma';
import { EMAIL_QUEUE_NAME, emailQueue } from './queue/emailQueue';
import { sendEmail, getSenderPassword } from './services/emailService';
import { checkAndIncrementRateLimit, findNextAvailableWindow } from './lib/rateLimiter';
import { notifyRateLimitHit } from './services/slackNotifier';
import { updateEmailStatus } from './lib/elasticsearch';

export interface EmailJobData {
  emailId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  userId: string;
  hourlyLimit?: number;
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, sender, recipient, subject, body, userId, hourlyLimit } = job.data;

  console.log(`[Worker] Processing job ${job.id} for email ${emailId} to ${recipient}`);

  // 1. Check DB status - skip if already sent (idempotency)
  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) {
    console.log(`[Worker] Email ${emailId} not found in DB, skipping`);
    return;
  }
  if (email.status === 'SENT') {
    console.log(`[Worker] Email ${emailId} already sent, skipping`);
    return;
  }

  // 2. Check rate limit
  const rateLimitResult = await checkAndIncrementRateLimit(sender, hourlyLimit);

  if (!rateLimitResult.allowed) {
    console.log(
      `[Worker] Rate limit hit for sender ${sender}: ${rateLimitResult.currentCount}/${rateLimitResult.limit}`
    );

    // Notify via Slack (at most once per sender per hour)
    await notifyRateLimitHit(userId, sender, rateLimitResult.limit, rateLimitResult.currentCount);

    // Find next available window and re-enqueue
    const effectiveLimit = hourlyLimit || config.maxEmailsPerHourPerSender;
    const nextWindowMs = await findNextAvailableWindow(sender, effectiveLimit);
    const delayMs = Math.max(nextWindowMs - Date.now(), 1000);

    console.log(`[Worker] Re-scheduling email ${emailId} with delay ${delayMs}ms`);

    // Update scheduled time in DB
    await prisma.email.update({
      where: { id: emailId },
      data: { scheduledAt: new Date(Date.now() + delayMs) },
    });

    // Add a new delayed job (the current job will complete, the new one fires later)
    await emailQueue.add(
      'send-email',
      job.data,
      {
        jobId: `${emailId}-retry-${Date.now()}`,
        delay: delayMs,
      }
    );

    return;
  }

  // 3. Get sender password
  const senderPassword = getSenderPassword(sender);
  if (!senderPassword) {
    console.error(`[Worker] No password found for sender ${sender}`);
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'FAILED', errorMessage: 'Sender credentials not configured' },
    });
    await updateEmailStatus(emailId, 'FAILED');
    return;
  }

  // 4. Send the email
  try {
    const result = await sendEmail({
      from: sender,
      to: recipient,
      subject,
      body,
      senderPassword,
    });

    console.log(`[Worker] Email sent: ${result.messageId}, preview: ${result.previewUrl}`);

    // 5. Mark as sent in DB (crash window: if we crash here, the email was sent but DB not updated.
    // On restart, the job won't re-run because BullMQ considers it complete.
    // The idempotency check above handles the case where the job IS retried.)
    const now = new Date();
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SENT', sentAt: now },
    });

    // 6. Update Elasticsearch
    await updateEmailStatus(emailId, 'SENT', now.toISOString());

    // 7. Enforce minimum delay between sends
    if (config.minSendDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.minSendDelayMs));
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Failed to send email ${emailId}:`, errorMessage);

    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'FAILED', errorMessage },
    });
    await updateEmailStatus(emailId, 'FAILED');

    throw err; // Let BullMQ handle retry via backoff
  }
}

const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
  concurrency: config.workerConcurrency,
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job?.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Error:', err);
});

console.log(
  `[Worker] Started with concurrency=${config.workerConcurrency}, minDelay=${config.minSendDelayMs}ms`
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down...');
  await worker.close();
  process.exit(0);
});
