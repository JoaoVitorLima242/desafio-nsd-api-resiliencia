// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import express from 'express';
import { activateProfile, chaos, stopChaos } from './chaos.js';
import { loadProfileFromFile } from './profile.js';
import { catalog } from './routes/catalog.js';
import { inventory } from './routes/inventory.js';
import { payments } from './routes/payments.js';
import { notifications } from './routes/notifications.js';
import { shipments } from './routes/shipments.js';
import { control } from './routes/control.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.use(control);

app.use('/catalog', chaos('catalog'), catalog);
app.use('/inventory', chaos('inventory'), inventory);
app.use('/payments', chaos('payments'), payments);
app.use('/notifications', chaos('notifications'), notifications);
app.use('/shipments', chaos('shipments'), shipments);

const profilePath = process.env.EXTERNAL_PROFILE ?? './profiles/dev.json';
try {
  activateProfile(loadProfileFromFile(profilePath));
  console.log(`perfil carregado de ${profilePath}`);
} catch (err) {
  console.error(`falha ao carregar perfil ${profilePath}:`, err.message);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, () => {
  console.log(`external-api ouvindo na porta ${PORT}`);
});

function shutdown(signal) {
  console.log(`recebido ${signal}, encerrando...`);
  stopChaos();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
