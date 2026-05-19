import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { env } from '@/src/config/env';

const EVOLUTION_API_URL = env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'scheduler';

const client = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    apikey: EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

interface InstanceState {
  instance: {
    instanceName: string;
    state: string;
  };
}

interface CreateInstanceResponse {
  instance: { instanceName: string };
  qrcode?: { base64: string };
}

async function checkReachable(maxWaitMs = 30_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      await client.get('/');
      return;
    } catch (err) {
      const e = err as AxiosError;
      if (e.response) {
        // We reached the server, but it returned an error status (e.g., 401, 404)
        return;
      }
      // Not reachable yet, wait and retry
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  throw new Error(`Evolution API not reachable at ${EVOLUTION_API_URL}: timeout exceeded`);
}

/** Returns the connection state (e.g. 'open', 'connecting', 'close') or null if the instance doesn't exist. */
async function getInstanceState(): Promise<string | null> {
  try {
    const res = await client.get<InstanceState>(`/instance/connectionState/${INSTANCE_NAME}`);
    return res.data.instance.state;
  } catch (err) {
    const e = err as AxiosError;
    if (e.response?.status === 404) return null;
    throw err;
  }
}

async function deleteInstance(): Promise<void> {
  await client.delete(`/instance/delete/${INSTANCE_NAME}`);
}

async function createInstance(): Promise<string | null> {
  const res = await client.post<CreateInstanceResponse>('/instance/create', {
    instanceName: INSTANCE_NAME,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  });
  return res.data.qrcode?.base64 ?? null;
}

interface ConnectResponse {
  count?: number;
  base64?: string;
  code?: string;
}

async function pollQrCode(maxWaitMs = 30_000): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await client.get<ConnectResponse>(`/instance/connect/${INSTANCE_NAME}`);
      if (res.data.base64) return res.data.base64;
      if (res.data.code) return res.data.code;
    } catch {
      // not ready yet
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 2_000));
  }
  process.stdout.write('\n');
  return null;
}

export const QR_TMP_DIR = path.join(os.tmpdir(), 'whatsapp-scheduler');

function saveQrPng(base64: string): void {
  const data = base64.replace(/^data:image\/png;base64,/, '');
  fs.mkdirSync(QR_TMP_DIR, { recursive: true });
  const outPath = path.join(QR_TMP_DIR, 'qr.png');
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`QR code saved to ${outPath}`);
}

function printQrToTerminal(base64: string): void {
  console.log('\nQR Code (Base64):');
  console.log(base64);
}

async function main(): Promise<void> {
  console.log(`Connecting to Evolution API at ${EVOLUTION_API_URL}...`);
  await checkReachable();
  console.log('Evolution API is reachable.');

  let state = await getInstanceState();

  if (state === 'open') {
    console.log(`Instance "${INSTANCE_NAME}" is already authenticated. Nothing to do.`);
    return;
  }

  if (state !== null) {
    // Instance exists but is not authenticated (e.g. stuck in 'connecting' or 'close').
    // Delete it so we can create a fresh one and get a new QR code.
    console.log(`Instance "${INSTANCE_NAME}" found in state "${state}" — deleting stale instance...`);
    await deleteInstance();
    // Brief pause: Evolution API returns 403 if you recreate the same name immediately after deletion.
    await new Promise((r) => setTimeout(r, 3_000));
    console.log('Stale instance deleted.');
  }

  console.log(`Creating instance "${INSTANCE_NAME}"...`);
  await createInstance();
  console.log(`Instance created. Polling for QR code...`);

  const qrBase64 = await pollQrCode();

  if (qrBase64) {
    saveQrPng(qrBase64);
    printQrToTerminal(qrBase64);
  } else {
    console.log('No QR code returned — timed out waiting for the API to generate one. Try running again.');
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error('init-evolution failed:', err.message);
  process.exit(1);
});
