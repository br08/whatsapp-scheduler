import { Queue } from 'bullmq';
import { redisConnection } from '@/src/queues/connection';

export const QUEUE_NAME = 'messages';

export const messageQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
  },
});

export async function enqueueMessage(messageId: string, sendAt: Date): Promise<void> {
  const delay = Math.max(0, sendAt.getTime() - Date.now());
  await messageQueue.add('send', { messageId }, { delay });
}
