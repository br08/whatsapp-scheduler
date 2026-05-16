import type { Job } from 'bullmq';
import { prisma } from '@/src/db/client';
import { sendTextMessage } from '@/src/services/whatsapp';
import { MessageStatus } from '@prisma/client';
import { logger } from '@/src/utils/logger';

export const MAX_RETRIES = 3;

export async function processJob(job: Job): Promise<void> {
  const { messageId } = job.data as { messageId: string };

  const message = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: messageId } });

  if (message.status === MessageStatus.SENT) {
    logger.info({ messageId }, 'Message already sent, skipping');
    return;
  }

  try {
    await sendTextMessage(message.recipient, message.body);
    await prisma.scheduledMessage.update({
      where: { id: messageId },
      data: { status: MessageStatus.SENT },
    });
  } catch (err) {
    const isLastAttempt = job.attemptsMade >= MAX_RETRIES - 1;
    await prisma.scheduledMessage.update({
      where: { id: messageId },
      data: {
        retryCount: message.retryCount + 1,
        status: isLastAttempt ? MessageStatus.FAILED : MessageStatus.PENDING,
      },
    });
    logger.error({ messageId, attempt: job.attemptsMade, isLastAttempt }, 'Message send failed');
    throw err;
  }
}
