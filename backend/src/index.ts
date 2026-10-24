import express from 'express';
import cors from 'cors';
import passport from 'passport';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { emailQueue } from './queue/emailQueue';
import { ensureIndex } from './lib/elasticsearch';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import slackRoutes from './routes/slack';

const app = express();

// Middleware
const allowedOrigins = [
  config.frontendUrl,
  /\.vercel\.app$/,   // Allow all Vercel preview deployments
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server
    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(allowed ? null : new Error('CORS not allowed'), allowed);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(passport.initialize());

// Bull Board setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// Routes
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Elasticsearch index
async function initializeES(): Promise<void> {
  try {
    await ensureIndex();
    console.log('[ES] Index ready');
  } catch (err) {
    console.warn('[ES] Could not initialize index (may not be running yet):', (err as Error).message);
  }
}

// Start server
app.listen(config.port, async () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Bull Board] http://localhost:${config.port}/admin/queues`);
  await initializeES();
});

export default app;
