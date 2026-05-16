import 'dotenv/config';
import { spawn } from 'child_process';
import axios, { AxiosError } from 'axios';
import { Client } from 'pg';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? '';
const INSTANCE_NAME = 'scheduler';

const apiClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: { apikey: EVOLUTION_API_KEY },
  timeout: 5_000,
});

interface InstanceState {
  instance: { instanceName: string; state: string };
}

function run(cmd: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[startup] ${label}...`);
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: false });
    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(`[startup] ${label} — done`);
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

function runLive(cmd: string, args: string[], label: string): void {
  console.log(`[startup] ${label}...`);
  const proc = spawn(cmd, args, { stdio: 'inherit', shell: false });
  proc.on('exit', (code) => process.exit(code ?? 0));
  proc.on('error', (err) => {
    console.error(`[startup] ${label} error:`, err.message);
    process.exit(1);
  });
}

async function waitForPostgres(maxWaitMs = 60_000): Promise<void> {
  console.log('[startup] waiting for PostgreSQL to be ready...');
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.end();
      console.log('[startup] PostgreSQL ready');
      return;
    } catch {
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  process.stdout.write('\n');
  throw new Error('Timed out waiting for PostgreSQL');
}

async function waitForEvolutionApi(maxWaitMs = 60_000): Promise<void> {
  console.log('[startup] waiting for Evolution API to be reachable...');
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      await apiClient.get('/');
      console.log('[startup] Evolution API reachable');
      return;
    } catch (err) {
      const e = err as AxiosError;
      if (e.response) {
        // Server responded (any status) — it's up
        console.log('[startup] Evolution API reachable');
        return;
      }
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  process.stdout.write('\n');
  throw new Error('Timed out waiting for Evolution API');
}

async function waitForAuthenticated(maxWaitMs = 120_000): Promise<void> {
  console.log('[startup] waiting for Evolution API instance to authenticate (scan the QR code)...');
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await apiClient.get<InstanceState>(`/instance/connectionState/${INSTANCE_NAME}`);
      if (res.data.instance.state === 'open') {
        console.log('[startup] Evolution API authenticated — ready');
        return;
      }
    } catch {
      // instance not ready yet — keep polling
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 3_000));
  }
  process.stdout.write('\n');
  throw new Error('Timed out waiting for Evolution API to reach authenticated state');
}

async function main(): Promise<void> {
  // 1. Start docker services
  await run('docker', ['compose', 'up', '-d'], 'infra:up (docker compose)');

  // 2. Wait for both services to be reachable before proceeding
  await Promise.all([waitForPostgres(), waitForEvolutionApi()]);

  // 3. Apply DB migrations and init Evolution API instance concurrently
  await Promise.all([
    run('npx', ['prisma', 'migrate', 'deploy'], 'prisma migrate deploy'),
    run('tsx', ['scripts/init-evolution.ts'], 'infra:init (Evolution API)'),
  ]);

  // 4. Block until the WhatsApp instance is fully authenticated (state === 'open')
  await waitForAuthenticated();

  // 5. Start the application (keeps process alive)
  runLive('tsx', ['src/index.ts'], 'dev server');
}

main().catch((err: Error) => {
  console.error('[startup] failed:', err.message);
  process.exit(1);
});
