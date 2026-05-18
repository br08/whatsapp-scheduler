import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { cleanTmpDir, processTmpCleanupJob, TMP_DIR } from '@/src/queues/tmpCleanup';

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `ws-test-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('cleanTmpDir', () => {
  it('does nothing when dir does not exist', async () => {
    await expect(cleanTmpDir('/nonexistent/path/ws-test-xyz')).resolves.toBeUndefined();
  });

  it('removes files inside the dir', async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'qr.png'), 'data');
    fs.writeFileSync(path.join(dir, 'other.txt'), 'data');

    await cleanTmpDir(dir);

    expect(fs.readdirSync(dir)).toHaveLength(0);
    fs.rmdirSync(dir);
  });

  it('removes nested directories inside the dir', async () => {
    const dir = makeTmpDir();
    const subDir = path.join(dir, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'nested.txt'), 'nested');

    await cleanTmpDir(dir);

    expect(fs.readdirSync(dir)).toHaveLength(0);
    fs.rmdirSync(dir);
  });
});

describe('processTmpCleanupJob', () => {
  it('runs without error (TMP_DIR may or may not exist)', async () => {
    await expect(processTmpCleanupJob()).resolves.toBeUndefined();
  });

  it('cleans TMP_DIR when it exists', async () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(path.join(TMP_DIR, 'qr.png'), 'data');

    await processTmpCleanupJob();

    expect(fs.readdirSync(TMP_DIR)).toHaveLength(0);
  });
});
