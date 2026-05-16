import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { enqueueMessage } from '@/src/queues/producer';
import { MessageStatus } from '@prisma/client';

const scheduleSchema = z.object({
  recipient: z.string().min(1),
  body: z.string().min(1),
  scheduledTime: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), { message: 'scheduledTime must be a valid ISO date' })
    .refine((s) => new Date(s).getTime() > Date.now(), { message: 'scheduledTime must be in the future' }),
});

export const router = Router();

router.post('/schedule', async (req, res) => {
  const result = scheduleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }

  const { recipient, body, scheduledTime } = result.data;
  const sendAt = new Date(scheduledTime);

  const message = await prisma.scheduledMessage.create({
    data: { recipient, body, sendAt, status: MessageStatus.PENDING, retryCount: 0 },
  });

  await enqueueMessage(message.id, sendAt);

  res.status(201).json({ id: message.id, status: message.status });
});
