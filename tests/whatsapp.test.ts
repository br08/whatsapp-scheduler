import { http, HttpResponse } from 'msw';
import { server } from './mocks/evolutionApi';
import { sendTextMessage } from '@/src/services/whatsapp';
import { AppError } from '@/src/utils/errors';
import { env } from '@/src/config/env';

describe('sendTextMessage – network error (no response)', () => {
  it('wraps network-level AxiosError as AppError with 502 fallback status', async () => {
    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () =>
        HttpResponse.error(),
      ),
    );
    await expect(sendTextMessage('5511999998888', 'test')).rejects.toBeInstanceOf(AppError);
  });
});

describe('sendTextMessage – malformed response', () => {
  it('re-throws non-Axios errors (e.g. TypeError on missing key.id)', async () => {
    server.use(
      http.post(`${env.EVOLUTION_API_URL}/message/sendText/:instance`, () =>
        HttpResponse.json({ key: null }),
      ),
    );
    await expect(sendTextMessage('5511999998888', 'test')).rejects.toBeInstanceOf(TypeError);
  });
});
