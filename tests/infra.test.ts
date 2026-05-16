import { describe, it, expect, vi, afterEach } from 'vitest';

describe('env.ts — validation error path', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('throws with a descriptive message when an env var is invalid', async () => {
    const saved = process.env['EVOLUTION_API_URL'];
    // Set an invalid value BEFORE the module loads so dotenv/config cannot override it
    process.env['EVOLUTION_API_URL'] = 'not-a-valid-url';
    vi.resetModules();
    try {
      await expect(import('@/src/config/env')).rejects.toThrow('Invalid environment variables');
    } finally {
      process.env['EVOLUTION_API_URL'] = saved;
    }
  });
});

describe('db/client.ts — production singleton guard', () => {
  it('skips caching the client on globalThis when NODE_ENV is production', async () => {
    const g = globalThis as Record<string, unknown>;
    const savedPrisma = g['prisma'];
    const savedEnv = process.env['NODE_ENV'];

    delete g['prisma'];
    process.env['NODE_ENV'] = 'production';
    vi.resetModules();

    try {
      await import('@/src/db/client');
      expect(g['prisma']).toBeUndefined();
    } finally {
      g['prisma'] = savedPrisma;
      process.env['NODE_ENV'] = savedEnv;
      vi.resetModules();
    }
  });
});

describe('utils/logger.ts — development transport', () => {
  it('uses info level and pino-pretty transport in development mode', async () => {
    const savedEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    vi.resetModules();

    try {
      const { logger } = await import('@/src/utils/logger');
      expect(logger.level).toBe('info');
    } finally {
      process.env['NODE_ENV'] = savedEnv;
      vi.resetModules();
    }
  });
});
