import request from 'supertest';
import { app } from '@/src/api/app';
import { prisma } from '@/src/db/client';
import { MessageStatus } from '@prisma/client';

const futureTime = () => new Date(Date.now() + 60_000).toISOString();

describe('POST /api/schedule – happy path', () => {
  it('saves a PENDING record and returns 201 with the message id', async () => {
    const payload = {
      recipient: '5511999998888',
      body: 'Hello from test!',
      scheduledTime: futureTime(),
    };

    const res = await request(app).post('/api/schedule').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), status: 'PENDING' });

    const record = await prisma.scheduledMessage.findUnique({ where: { id: res.body.id } });
    expect(record).not.toBeNull();
    expect(record!.status).toBe(MessageStatus.PENDING);
    expect(record!.recipient).toBe(payload.recipient);
    expect(record!.body).toBe(payload.body);
  });
});

describe('POST /api/schedule – validation', () => {
  it('returns 400 when recipient is missing', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .send({ body: 'hi', scheduledTime: futureTime() });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .send({ recipient: '5511999998888', scheduledTime: futureTime() });
    expect(res.status).toBe(400);
  });

  it('returns 400 when scheduledTime is in the past', async () => {
    const res = await request(app).post('/api/schedule').send({
      recipient: '5511999998888',
      body: 'hello',
      scheduledTime: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when scheduledTime is not a valid ISO date', async () => {
    const res = await request(app).post('/api/schedule').send({
      recipient: '5511999998888',
      body: 'hello',
      scheduledTime: 'not-a-date',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when recipient is an empty string', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .send({ recipient: '', body: 'hello', scheduledTime: futureTime() });
    expect(res.status).toBe(400);
  });
});
