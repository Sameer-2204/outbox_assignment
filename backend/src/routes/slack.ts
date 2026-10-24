import { Router, Request, Response } from 'express';
import { config } from '../config';
import prisma from '../lib/prisma';
import { authMiddleware, getAuthUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/slack/install
 * Start Slack OAuth flow - returns the authorization URL
 */
router.get('/install', authMiddleware, (req: Request, res: Response) => {
  const userId = getAuthUser(req).id;

  if (!config.slack.clientId) {
    res.status(500).json({ error: 'Slack is not configured' });
    return;
  }

  // Store userId in state parameter
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', config.slack.clientId);
  slackAuthUrl.searchParams.set('scope', 'incoming-webhook');
  slackAuthUrl.searchParams.set('redirect_uri', config.slack.redirectUri);
  slackAuthUrl.searchParams.set('state', state);

  res.json({ url: slackAuthUrl.toString() });
});

/**
 * GET /api/slack/callback
 * Slack OAuth callback - exchanges code for webhook URL
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code: string; state: string };

    if (!code || !state) {
      res.redirect(`${config.frontendUrl}?slack_error=missing_params`);
      return;
    }

    // Decode state to get userId
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
    } catch {
      res.redirect(`${config.frontendUrl}?slack_error=invalid_state`);
      return;
    }

    // Exchange code for access token and webhook
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: config.slack.redirectUri,
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      ok: boolean;
      error?: string;
      incoming_webhook?: {
        url: string;
        channel: string;
      };
      team?: {
        name: string;
      };
    };

    if (!tokenData.ok || !tokenData.incoming_webhook) {
      console.error('[Slack] OAuth error:', tokenData.error);
      res.redirect(`${config.frontendUrl}?slack_error=${tokenData.error || 'unknown'}`);
      return;
    }

    // Store webhook in DB
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        webhookUrl: tokenData.incoming_webhook.url,
        channelName: tokenData.incoming_webhook.channel,
        teamName: tokenData.team?.name,
      },
      create: {
        userId,
        webhookUrl: tokenData.incoming_webhook.url,
        channelName: tokenData.incoming_webhook.channel,
        teamName: tokenData.team?.name,
      },
    });

    res.redirect(`${config.frontendUrl}?slack_connected=true`);
  } catch (err) {
    console.error('[Slack] Callback error:', err);
    res.redirect(`${config.frontendUrl}?slack_error=server_error`);
  }
});

/**
 * GET /api/slack/status
 * Check if user has connected Slack
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req).id;

    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    res.json({
      connected: !!connection,
      channelName: connection?.channelName || null,
      teamName: connection?.teamName || null,
    });
  } catch (err) {
    console.error('[Slack] Status error:', err);
    res.status(500).json({ error: 'Failed to check Slack status' });
  }
});

/**
 * DELETE /api/slack/disconnect
 * Disconnect Slack
 */
router.delete('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req).id;

    await prisma.slackConnection.deleteMany({
      where: { userId },
    });

    res.json({ message: 'Slack disconnected' });
  } catch (err) {
    console.error('[Slack] Disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;
