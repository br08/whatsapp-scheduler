import { processCleanupJob } from '@/src/queues/cleanup';
import { prisma } from '@/src/db/client';
import { MessageStatus } from '@prisma/client';

const SENT_DAYS = 7;
const FAILED_DAYS = 1;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function createMessage(status: MessageStatus, updatedAt: Date) {
  const record = await prisma.scheduledMessage.create({
    data: {
      recipient: '5511999998888',
      body: 'cleanup test',
      sendAt: new Date(Date.now() + 60_000),
      status,
      retryCount: 0,
    },
  });
  await prisma.scheduledMessage.update({
    where: { id: record.id },
    data: { updatedAt },
  });
  return record;
}

describe('cleanup – SENT past retention', () => {
  it('deletes SENT messages older than SENT_RETENTION_DAYS', async () => {
    const old = await createMessage(MessageStatus.SENT, daysAgo(SENT_DAYS + 1));
    await processCleanupJob(SENT_DAYS, FAILED_DAYS);
    const found = await prisma.scheduledMessage.findUnique({ where: { id: old.id } });
    expect(found).toBeNull();
  });
});

describe('cleanup – FAILED past retention', () => {
  it('deletes FAILED messages older than FAILED_RETENTION_DAYS', async () => {
    const old = await createMessage(MessageStatus.FAILED, daysAgo(FAILED_DAYS + 1));
    await processCleanupJob(SENT_DAYS, FAILED_DAYS);
    const found = await prisma.scheduledMessage.findUnique({ where: { id: old.id } });
    expect(found).toBeNull();
  });
});

describe('cleanup – within retention window', () => {
  it('keeps SENT messages younger than SENT_RETENTION_DAYS', async () => {
    const recent = await createMessage(MessageStatus.SENT, daysAgo(SENT_DAYS - 1));
    await processCleanupJob(SENT_DAYS, FAILED_DAYS);
    const found = await prisma.scheduledMessage.findUnique({ where: { id: recent.id } });
    expect(found).not.toBeNull();
  });

  it('keeps FAILED messages younger than FAILED_RETENTION_DAYS', async () => {
    const recent = await createMessage(MessageStatus.FAILED, new Date(Date.now() - 60_000));
    await processCleanupJob(SENT_DAYS, FAILED_DAYS);
    const found = await prisma.scheduledMessage.findUnique({ where: { id: recent.id } });
    expect(found).not.toBeNull();
  });
});

describe('cleanup – PENDING never deleted', () => {
  it('never deletes PENDING messages regardless of age', async () => {
    const pending = await createMessage(MessageStatus.PENDING, daysAgo(30));
    await processCleanupJob(SENT_DAYS, FAILED_DAYS);
    const found = await prisma.scheduledMessage.findUnique({ where: { id: pending.id } });
    expect(found).not.toBeNull();
  });
});

describe('cleanup – nothing to clean', () => {
  it('completes without error when the database is empty', async () => {
    await expect(processCleanupJob(SENT_DAYS, FAILED_DAYS)).resolves.not.toThrow();
  });
});
