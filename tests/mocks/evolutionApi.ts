import { http, HttpResponse, passthrough } from 'msw';
import { setupServer } from 'msw/node';
import { env } from '@/src/config/env';

export const MOCK_MESSAGE_ID = 'mock-msg-id-001';

export const evolutionHandlers = [
  http.all('http://127.0.0.1/*', () => passthrough()),
  http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () => {
    return HttpResponse.json({
      key: { id: MOCK_MESSAGE_ID },
      status: 'PENDING',
    });
  }),
];

export const server = setupServer(...evolutionHandlers);
