import prisma from '../lib/prisma';
import { checkAndMarkRateLimitNotification } from '../lib/rateLimiter';

/**
 * Send a Slack notification when rate limit is hit.
 * - Sends at most one notification per sender per hour window.
 * - Skips silently if Slack is not connected.
 */
export async function notifyRateLimitHit(
  userId: string,
  sender: string,
  limit: number,
  currentCount: number
): Promise<void> {
  try {
    // Check if already notified this hour for this sender
    const alreadyNotified = await checkAndMarkRateLimitNotification(sender);
    if (alreadyNotified) {
      return;
    }

    // Look up user's Slack connection
    const slackConnection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!slackConnection || !slackConnection.webhookUrl) {
      // Slack not connected, skip silently
      return;
    }

    const message = {
      text: `⚠️ *Rate Limit Reached*\n\nSender \`${sender}\` has hit the hourly email limit.\n• *Limit:* ${limit} emails/hour\n• *Sent this hour:* ${currentCount}\n• *Action:* Remaining emails have been delayed to the next available window.\n\n_This is an automated notification from Outbox Scheduler._`,
    };

    const response = await fetch(slackConnection.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[Slack] Failed to send notification:', response.status, await response.text());
    } else {
      console.log('[Slack] Rate limit notification sent for sender:', sender);
    }
  } catch (err) {
    // Don't crash the worker if Slack notification fails
    console.error('[Slack] Error sending notification:', err);
  }
}
