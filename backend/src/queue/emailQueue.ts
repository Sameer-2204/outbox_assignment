import { Queue } from 'bullmq';
import { config } from '../config';

export const EMAIL_QUEUE_NAME = 'email-send';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});
