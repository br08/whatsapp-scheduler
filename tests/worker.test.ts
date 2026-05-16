import { processJob, MAX_RETRIES } from '@/src/queues/worker';
import { prisma } from '@/src/db/client';
import { MessageStatus } from '@prisma/client';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/evolutionApi';
import { env } from '@/src/config/env';
import type { Job } from 'bullmq';

function makeMockJob(data: Record<string, unknown>, attemptsMade = 0): Job {
  return { id: 'test-job-id', data, attemptsMade } as unknown as Job;
}

async function createMessage(overrides: Partial<{
  recipient: string;
  body: string;
  sendAt: Date;
  status: MessageStatus;
  retryCount: number;
}> = {}) {
  return prisma.scheduledMessage.create({
    data: {
      recipient: '5511999998888',
      body: 'Test message',
      sendAt: new Date(Date.now() + 60_000),
      status: MessageStatus.PENDING,
      retryCount: 0,
      ...overrides,
    },
  });
}

describe('worker – happy path', () => {
  it('sends the message via Evolution API and marks the record SENT', async () => {
    const message = await createMessage();
    const job = makeMockJob({ messageId: message.id });

    await processJob(job);

    const updated = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updated.status).toBe(MessageStatus.SENT);
  });
});

describe('worker – gateway down', () => {
  it('increments retryCount, leaves status PENDING, and re-throws', async () => {
    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () =>
        HttpResponse.json({ error: 'Gateway unavailable' }, { status: 500 }),
      ),
    );

    const message = await createMessage();
    const job = makeMockJob({ messageId: message.id });

    await expect(processJob(job)).rejects.toThrow();

    const updated = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updated.status).toBe(MessageStatus.PENDING);
    expect(updated.retryCount).toBe(1);
  });
});

describe('worker – max retries exceeded', () => {
  it('marks the record FAILED on the final attempt and re-throws', async () => {
    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () =>
        HttpResponse.json({ error: 'Gateway unavailable' }, { status: 500 }),
      ),
    );

    const message = await createMessage({ retryCount: MAX_RETRIES - 1 });
    const job = makeMockJob({ messageId: message.id }, MAX_RETRIES - 1);

    await expect(processJob(job)).rejects.toThrow();

    const updated = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updated.status).toBe(MessageStatus.FAILED);
  });
});

describe('worker – idempotency', () => {
  it('skips Evolution API and resolves cleanly if message is already SENT', async () => {
    const message = await createMessage({ status: MessageStatus.SENT });
    const job = makeMockJob({ messageId: message.id });

    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () =>
        HttpResponse.json({ error: 'Should not be called' }, { status: 500 }),
      ),
    );

    await expect(processJob(job)).resolves.not.toThrow();

    const updated = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updated.status).toBe(MessageStatus.SENT);
  });
});
