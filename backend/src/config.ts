import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // Elasticsearch
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
  },

  // Session / JWT
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',

  // Ethereal accounts
  etherealAccounts: parseEtherealAccounts(process.env.ETHEREAL_ACCOUNTS || ''),

  // Worker
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
  minSendDelayMs: parseInt(process.env.MIN_SEND_DELAY_MS || '2000', 10),

  // Rate limiting
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),

  // Slack
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/api/slack/callback',
  },
};

function parseEtherealAccounts(raw: string): Array<{ email: string; password: string }> {
  if (!raw.trim()) return [];
  return raw.split(',').map((entry) => {
    const [email, password] = entry.trim().split(':');
    return { email, password };
  });
}
