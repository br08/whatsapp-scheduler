import { Worker } from 'bullmq';
import { app } from '@/src/api/app';
import { env } from '@/src/config/env';
import { prisma } from '@/src/db/client';
import { redisConnection } from '@/src/queues/connection';
import { messageQueue, QUEUE_NAME } from '@/src/queues/producer';
import { processJob } from '@/src/queues/worker';
import { logger } from '@/src/utils/logger';

const PORT = env.PORT;

const worker = new Worker(QUEUE_NAME, processJob, { connection: redisConnection });

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Job permanently failed');
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'HTTP server started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  await worker.close();
  logger.info('BullMQ worker closed');

  await messageQueue.close();
  logger.info('BullMQ queue closed');

  await redisConnection.quit();
  logger.info('Redis connection closed');

  await prisma.$disconnect();
  logger.info('Prisma disconnected');

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
