/**
 * Combined entry: starts the Express API server AND the BullMQ worker
 * in the same process. Suitable for single-dyno / single-service deployments
 * (e.g. Render Web Service free tier).
 *
 * For production scale, run worker.ts as a separate background worker.
 */
import dotenv from 'dotenv';
dotenv.config();

// Start the Express server (which also sets up Bull Board)
import './index';

// Start the BullMQ worker inline
import { Worker } from 'bullmq';
import { config } from './config';
import prisma from './lib/prisma';
import { EMAIL_QUEUE_NAME, emailQueue } from './queue/emailQueue';
import { sendEmail, getSenderPassword } from './services/emailService';
import { checkAndIncrementRateLimit, findNextAvailableWindow } from './lib/rateLimiter';
import { notifyRateLimitHit } from './services/slackNotifier';
import { updateEmailStatus } from './lib/elasticsearch';
import type { EmailJobData } from './worker';

async function processEmailJob(job: import('bullmq').Job<EmailJobData>): Promise<void> {
  const { emailId, sender, recipient, subject, body, userId, hourlyLimit } = job.data;
  console.log(`[Worker] Processing job ${job.id} for email ${emailId} to ${recipient}`);

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) { console.log(`[Worker] Email ${emailId} not found, skipping`); return; }
  if (email.status === 'SENT') { console.log(`[Worker] Email ${emailId} already sent, skipping`); return; }

  const rateLimitResult = await checkAndIncrementRateLimit(sender, hourlyLimit);
  if (!rateLimitResult.allowed) {
    console.log(`[Worker] Rate limit hit for ${sender}`);
    await notifyRateLimitHit(userId, sender, rateLimitResult.limit, rateLimitResult.currentCount);
    const effectiveLimit = hourlyLimit || config.maxEmailsPerHourPerSender;
    const nextWindowMs = await findNextAvailableWindow(sender, effectiveLimit);
    const delayMs = Math.max(nextWindowMs - Date.now(), 1000);
    await prisma.email.update({ where: { id: emailId }, data: { scheduledAt: new Date(Date.now() + delayMs) } });
    await emailQueue.add('send-email', job.data, { jobId: `${emailId}-retry-${Date.now()}`, delay: delayMs });
    return;
  }

  const senderPassword = getSenderPassword(sender);
  if (!senderPassword) {
    await prisma.email.update({ where: { id: emailId }, data: { status: 'FAILED', errorMessage: 'Sender credentials not configured' } });
    await updateEmailStatus(emailId, 'FAILED');
    return;
  }

  try {
    const result = await sendEmail({ from: sender, to: recipient, subject, body, senderPassword });
    console.log(`[Worker] Sent: ${result.messageId} | Preview: ${result.previewUrl}`);
    const now = new Date();
    await prisma.email.update({ where: { id: emailId }, data: { status: 'SENT', sentAt: now } });
    await updateEmailStatus(emailId, 'SENT', now.toISOString());
    if (config.minSendDelayMs > 0) await new Promise((r) => setTimeout(r, config.minSendDelayMs));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Failed to send ${emailId}:`, errorMessage);
    await prisma.email.update({ where: { id: emailId }, data: { status: 'FAILED', errorMessage } });
    await updateEmailStatus(emailId, 'FAILED');
    throw err;
  }
}

const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: { host: config.redis.host, port: config.redis.port },
  concurrency: config.workerConcurrency,
});

worker.on('completed', (job) => console.log(`[Worker] Job ${job?.id} completed`));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));
worker.on('error', (err) => console.error('[Worker] Error:', err));

console.log(`[Worker] Started inline with concurrency=${config.workerConcurrency}`);

process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
process.on('SIGINT',  async () => { await worker.close(); process.exit(0); });
