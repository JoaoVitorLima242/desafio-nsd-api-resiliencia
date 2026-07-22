// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { Router } from 'express';
import { send } from '../chaos.js';
import {
  createAuthorization,
  getAuthorization,
  listAuthorizationsByOrder,
  refundAuthorization,
} from '../state.js';

export const payments = Router();

payments.post('/authorizations', (req, res) => {
  const { order_id, amount_cents, currency } = req.body ?? {};
  if (!order_id || !Number.isInteger(amount_cents) || amount_cents <= 0) {
    send(req, res, 400, { error: 'invalid_body' });
    return;
  }
  const key = req.header('Idempotency-Key') || null;
  const result = createAuthorization(order_id, amount_cents, currency ?? 'BRL', key);

  send(req, res, result.replayed ? 200 : 201, result.authorization);
});

payments.get('/authorizations', (req, res) => {
  const orderId = req.query.order_id;
  if (!orderId) {
    send(req, res, 400, { error: 'order_id_required' });
    return;
  }
  send(req, res, 200, { authorizations: listAuthorizationsByOrder(orderId) });
});

payments.get('/authorizations/:id', (req, res) => {
  const auth = getAuthorization(req.params.id);
  if (!auth) {
    send(req, res, 404, { error: 'not_found' });
    return;
  }
  send(req, res, 200, auth);
});

payments.post('/authorizations/:id/refund', (req, res) => {
  const result = refundAuthorization(req.params.id);
  if (result.error === 'not_found') {
    send(req, res, 404, { error: 'not_found' });
    return;
  }
  if (result.error === 'already_refunded') {
    send(req, res, 409, { error: 'already_refunded' });
    return;
  }
  send(req, res, 201, result.refund);
});
