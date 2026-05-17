import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { app } from '@/src/api/app';
import { prisma } from '@/src/db/client';
import { MessageStatus } from '@prisma/client';
import { server, MOCK_MESSAGE_ID } from './mocks/evolutionApi';
import { env } from '@/src/config/env';

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

describe('GET /api/schedule', () => {
  it('returns an empty array when there are no messages', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all scheduled messages ordered by sendAt asc', async () => {
    const later = new Date(Date.now() + 120_000).toISOString();
    const sooner = new Date(Date.now() + 60_000).toISOString();

    await request(app).post('/api/schedule').send({ recipient: 'a', body: 'later', scheduledTime: later });
    await request(app).post('/api/schedule').send({ recipient: 'b', body: 'sooner', scheduledTime: sooner });

    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].body).toBe('sooner');
    expect(res.body[1].body).toBe('later');
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      recipient: 'b',
      status: 'PENDING',
      retryCount: 0,
      sendAt: expect.any(String),
    });
  });
});

describe('GET /api/schedule/:id', () => {
  it('returns the message for a valid id', async () => {
    const post = await request(app)
      .post('/api/schedule')
      .send({ recipient: '5511999998888', body: 'find me', scheduledTime: futureTime() });
    const { id } = post.body;

    const res = await request(app).get(`/api/schedule/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      recipient: '5511999998888',
      body: 'find me',
      status: 'PENDING',
      retryCount: 0,
      sendAt: expect.any(String),
    });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/schedule/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Message not found' });
  });
});

describe('POST /api/send', () => {
  it('sends immediately and returns the Evolution API message id', async () => {
    const res = await request(app)
      .post('/api/send')
      .send({ recipient: '5511999998888', body: 'Hi! I am a test message!' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ messageId: MOCK_MESSAGE_ID });
  });

  it('returns 400 when recipient is missing', async () => {
    const res = await request(app).post('/api/send').send({ body: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing', async () => {
    const res = await request(app).post('/api/send').send({ recipient: '5511999998888' });
    expect(res.status).toBe(400);
  });

  it('returns 502 when Evolution API fails', async () => {
    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () => HttpResponse.error()),
    );
    const res = await request(app)
      .post('/api/send')
      .send({ recipient: '5511999998888', body: 'will fail' });
    expect(res.status).toBe(502);
  });

  it('returns 500 for unexpected non-AppError throws', async () => {
    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () =>
        HttpResponse.json({ key: null }),
      ),
    );
    const res = await request(app)
      .post('/api/send')
      .send({ recipient: '5511999998888', body: 'will throw TypeError' });
    expect(res.status).toBe(500);
  });
});
