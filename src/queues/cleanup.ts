import { prisma } from '@/src/db/client';
import { MessageStatus } from '@prisma/client';
import { logger } from '@/src/utils/logger';

export async function processCleanupJob(sentRetentionDays: number, failedRetentionDays: number): Promise<void> {
  const now = Date.now();

  const sentCutoff = new Date(now - sentRetentionDays * 24 * 60 * 60 * 1000);
  const failedCutoff = new Date(now - failedRetentionDays * 24 * 60 * 60 * 1000);

  const { count: sentDeleted } = await prisma.scheduledMessage.deleteMany({
    where: { status: MessageStatus.SENT, updatedAt: { lt: sentCutoff } },
  });

  const { count: failedDeleted } = await prisma.scheduledMessage.deleteMany({
    where: { status: MessageStatus.FAILED, updatedAt: { lt: failedCutoff } },
  });

  logger.info({ sentDeleted, failedDeleted }, 'Cleanup job completed');
}
