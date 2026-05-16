import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/src/db/client';
import { createClient } from 'redis';
import { server } from './mocks/evolutionApi';
import { env } from '@/src/config/env';

const redis = createClient({ url: env.REDIS_URL });

beforeAll(async () => {
  await redis.connect();
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(async () => {
  server.close();
  await redis.disconnect();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.scheduledMessage.deleteMany();
  await redis.flushDb();
  server.resetHandlers();
});
