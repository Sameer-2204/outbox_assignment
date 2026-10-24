/**
 * Load simulation script: schedules 1000+ emails with a low hourly limit.
 * This demonstrates rate-limiting behavior and automatic rescheduling.
 *
 * Usage: npm run simulate
 *
 * This script directly uses the queue and database, bypassing HTTP auth.
 * It is intended for local testing only.
 */

import dotenv from 'dotenv';
dotenv.config();

import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { emailQueue } from '../queue/emailQueue';
import { config } from '../config';

async function simulate(): Promise<void> {
  const NUM_EMAILS = 100; // Adjust: set to 1000+ for full test
  const HOURLY_LIMIT = 5; // Very low limit to trigger rate limiting quickly
  const SENDER = config.etherealAccounts[0]?.email || 'test@ethereal.email';

  console.log(`\n=== Load Simulation ===`);
  console.log(`Emails: ${NUM_EMAILS}`);
  console.log(`Hourly limit: ${HOURLY_LIMIT}`);
  console.log(`Sender: ${SENDER}`);
  console.log(`Worker concurrency: ${config.workerConcurrency}`);
  console.log('');

  // Create a test user if needed
  let user = await prisma.user.findFirst({ where: { email: 'test@test.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'simulate-test-user',
        email: 'test@test.com',
        name: 'Test User',
      },
    });
  }

  const startTime = new Date(Date.now() + 5000); // Start 5 seconds from now
  const delayMs = 100; // 100ms between emails

  const emails = [];
  const jobs = [];

  for (let i = 0; i < NUM_EMAILS; i++) {
    const emailId = uuidv4();
    const scheduledAt = new Date(startTime.getTime() + i * delayMs);

    emails.push({
      id: emailId,
      userId: user.id,
      sender: SENDER,
      recipient: `lead-${i + 1}@example.com`,
      subject: `Simulation Email #${i + 1}`,
      body: `<p>This is simulation email number ${i + 1} of ${NUM_EMAILS}.</p>`,
      status: 'SCHEDULED' as const,
      scheduledAt,
    });

    const jobDelay = Math.max(scheduledAt.getTime() - Date.now(), 0);

    jobs.push({
      name: 'send-email',
      data: {
        emailId,
        sender: SENDER,
        recipient: `lead-${i + 1}@example.com`,
        subject: `Simulation Email #${i + 1}`,
        body: `<p>This is simulation email number ${i + 1} of ${NUM_EMAILS}.</p>`,
        userId: user.id,
        hourlyLimit: HOURLY_LIMIT,
      },
      opts: {
        jobId: emailId,
        delay: jobDelay,
      },
    });
  }

  console.log('Creating emails in database...');
  await prisma.email.createMany({ data: emails });

  console.log('Adding jobs to queue...');
  await emailQueue.addBulk(jobs);

  console.log(`\n✅ Scheduled ${NUM_EMAILS} emails`);
  console.log(`First email at: ${startTime.toISOString()}`);
  console.log(`Last email scheduled at: ${new Date(startTime.getTime() + (NUM_EMAILS - 1) * delayMs).toISOString()}`);
  console.log(`\nWith hourly limit of ${HOURLY_LIMIT}, only ${HOURLY_LIMIT} emails will send per hour.`);
  console.log(`Remaining emails will be automatically delayed to the next hour window.`);
  console.log(`\nCheck Bull Board at http://localhost:${config.port}/admin/queues to see job states.`);
  console.log(`Check worker logs to see rate-limiting in action.\n`);

  await prisma.$disconnect();
  process.exit(0);
}

simulate().catch((err) => {
  console.error('Simulation error:', err);
  process.exit(1);
});
