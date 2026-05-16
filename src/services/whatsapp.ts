import axios from 'axios';
import { env } from '@/src/config/env';
import { logger } from '@/src/utils/logger';
import { AppError } from '@/src/utils/errors';

interface SendTextPayload {
  number: string;
  text: string;
}

interface SendTextResponse {
  key: { id: string };
  status: string;
}

const client = axios.create({
  baseURL: `${env.EVOLUTION_API_URL}/message`,
  headers: {
    apikey: env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

export async function sendTextMessage(recipient: string, body: string): Promise<string> {
  const payload: SendTextPayload = { number: recipient, text: body };

  try {
    const res = await client.post<SendTextResponse>(
      `/sendText/${env.EVOLUTION_INSTANCE}`,
      payload,
    );
    const messageId = res.data.key.id;
    logger.info({ recipient, messageId }, 'WhatsApp message sent');
    return messageId;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const detail = JSON.stringify(err.response?.data ?? err.message);
      logger.error({ recipient, status, detail }, 'WhatsApp send failed');
      throw new AppError(`WhatsApp gateway error (${status}): ${detail}`, status ?? 502);
    }
    throw err;
  }
}
