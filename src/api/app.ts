import express, { type NextFunction, type Request, type Response } from 'express';
import { router } from '@/src/api/routes';
import { AppError } from '@/src/utils/errors';
import { logger } from '@/src/utils/logger';

export const app = express();

app.use(express.json());
app.use('/api', router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});
