import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { enqueueMessage } from '@/src/queues/producer';
import { sendTextMessage } from '@/src/services/whatsapp';
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

const sendSchema = z.object({
  recipient: z.string().min(1),
  body: z.string().min(1),
});

router.post('/send', async (req, res) => {
  const result = sendSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }

  const { recipient, body } = result.data;
  const messageId = await sendTextMessage(recipient, body);
  res.status(200).json({ messageId });
});

const statusFilterSchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
});

router.get('/schedule', async (req, res) => {
  const result = statusFilterSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }
  const messages = await prisma.scheduledMessage.findMany({
    where: result.data.status ? { status: result.data.status } : undefined,
    orderBy: { sendAt: 'asc' },
    select: { id: true, recipient: true, body: true, sendAt: true, status: true, retryCount: true },
  });
  res.json(messages);
});

router.get('/schedule/:id', async (req, res) => {
  const result = statusFilterSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }
  const message = await prisma.scheduledMessage.findUnique({
    where: { id: req.params.id },
    select: { id: true, recipient: true, body: true, sendAt: true, status: true, retryCount: true },
  });
  if (!message || (result.data.status && message.status !== result.data.status)) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }
  res.json(message);
});
