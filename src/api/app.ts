import express from 'express';
import { router } from '@/src/api/routes';

export const app = express();

app.use(express.json());
app.use('/api', router);
