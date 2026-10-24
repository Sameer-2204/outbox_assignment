import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const redisSubscriber = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});
