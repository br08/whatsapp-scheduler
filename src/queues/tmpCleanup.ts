import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '@/src/utils/logger';

export const TMP_DIR = path.join(os.tmpdir(), 'whatsapp-scheduler');

export async function cleanTmpDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      logger.info({ path: fullPath }, 'Removed temp file');
    } catch (err) {
      logger.error({ path: fullPath, err }, 'Failed to remove temp file');
    }
  }
}

export async function processTmpCleanupJob(): Promise<void> {
  await cleanTmpDir(TMP_DIR);
}
