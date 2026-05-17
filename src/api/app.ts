import { readFileSync } from 'fs';
import { resolve } from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { router } from '@/src/api/routes';
import { AppError } from '@/src/utils/errors';
import { logger } from '@/src/utils/logger';

const swaggerDocument = yaml.load(
  readFileSync(resolve(__dirname, '../../docs/openapi.yaml'), 'utf8'),
) as Record<string, unknown>;

export const app = express();

app.use(express.json());
app.use('/api/docs', swaggerUi.serveFiles(swaggerDocument), swaggerUi.setup(swaggerDocument));
app.use('/api', router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});
