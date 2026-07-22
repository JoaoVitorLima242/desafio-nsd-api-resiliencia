import express, { type NextFunction, type Request, type Response } from 'express';
import { orders } from './orders.js';
import { pool } from './db.js';

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use(orders);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'internal_error' });
});

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`api ouvindo na porta ${PORT}`);
});

function shutdown(signal: string): void {
  console.log(`recebido ${signal}, encerrando...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
