import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? '';
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

async function checkReachable(): Promise<void> {
  try {
    await client.get('/');
  } catch (err) {
    const e = err as AxiosError;
    if (!e.response) {
      throw new Error(`Evolution API not reachable at ${EVOLUTION_API_URL}: ${e.message}`);
    }
  }
}

async function instanceExists(): Promise<boolean> {
  try {
    await client.get<InstanceState>(`/instance/connectionState/${INSTANCE_NAME}`);
    return true;
  } catch (err) {
    const e = err as AxiosError;
    if (e.response?.status === 404) return false;
    throw err;
  }
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

function saveQrPng(base64: string): void {
  const data = base64.replace(/^data:image\/png;base64,/, '');
  const outPath = path.resolve(process.cwd(), 'qr.png');
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

  const exists = await instanceExists();
  let qrBase64: string | null = null;

  if (exists) {
    console.log(`Instance "${INSTANCE_NAME}" already exists. Polling for QR code...`);
  } else {
    console.log(`Creating instance "${INSTANCE_NAME}"...`);
    await createInstance();
    console.log(`Instance "${INSTANCE_NAME}" created. Polling for QR code...`);
  }

  qrBase64 = await pollQrCode();

  if (qrBase64) {
    saveQrPng(qrBase64);
    printQrToTerminal(qrBase64);
  } else {
    console.log('No QR code returned — instance may already be authenticated.');
  }
}

main().catch((err: Error) => {
  console.error('init-evolution failed:', err.message);
  process.exit(1);
});
