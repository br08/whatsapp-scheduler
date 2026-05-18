import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { app } from '@/src/api/app';
import { env } from '@/src/config/env';
import { prisma } from '@/src/db/client';
import { redisConnection } from '@/src/queues/connection';
import { messageQueue, QUEUE_NAME } from '@/src/queues/producer';
import { processJob } from '@/src/queues/worker';
import { processCleanupJob } from '@/src/queues/cleanup';
import { processTmpCleanupJob } from '@/src/queues/tmpCleanup';
import { logger } from '@/src/utils/logger';

const PORT = env.PORT;

const CLEANUP_QUEUE_NAME = 'cleanup';
const TMP_CLEANUP_QUEUE_NAME = 'tmp-cleanup';

const cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, { connection: redisConnection });
void cleanupQueue.upsertJobScheduler('hourly-cleanup', { every: 60 * 60 * 1000 }, { name: 'cleanup' });

const cleanupWorker = new Worker(
  CLEANUP_QUEUE_NAME,
  () => processCleanupJob(env.SENT_RETENTION_DAYS, env.FAILED_RETENTION_DAYS),
  { connection: redisConnection },
);

cleanupWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Cleanup job failed');
});

const tmpCleanupQueue = new Queue(TMP_CLEANUP_QUEUE_NAME, { connection: redisConnection });
void tmpCleanupQueue.upsertJobScheduler('30min-tmp-cleanup', { every: 30 * 60 * 1000 }, { name: 'tmp-cleanup' });

const tmpCleanupWorker = new Worker(TMP_CLEANUP_QUEUE_NAME, processTmpCleanupJob, { connection: redisConnection });

tmpCleanupWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Tmp cleanup job failed');
});

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
  await cleanupWorker.close();
  await tmpCleanupWorker.close();
  logger.info('BullMQ workers closed');

  await messageQueue.close();
  await cleanupQueue.close();
  await tmpCleanupQueue.close();
  logger.info('BullMQ queues closed');

  await redisConnection.quit();
  logger.info('Redis connection closed');

  await prisma.$disconnect();
  logger.info('Prisma disconnected');

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
