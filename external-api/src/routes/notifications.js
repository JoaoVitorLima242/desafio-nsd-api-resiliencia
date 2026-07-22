// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { send } from '../chaos.js';

export const notifications = Router();

notifications.post('/', (req, res) => {
  const { order_id, channel, message } = req.body ?? {};
  if (!order_id || !channel || typeof message !== 'string') {
    send(req, res, 400, { error: 'invalid_body' });
    return;
  }
  send(req, res, 202, { notification_id: randomUUID() });
});
