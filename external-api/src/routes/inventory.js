// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { Router } from 'express';
import { send } from '../chaos.js';
import {
  createReservation,
  getReservation,
  listReservationsByOrder,
  releaseReservation,
} from '../state.js';

export const inventory = Router();

inventory.post('/reservations', (req, res) => {
  const { order_id, sku, qty } = req.body ?? {};
  if (!order_id || !sku || !Number.isInteger(qty) || qty <= 0) {
    send(req, res, 400, { error: 'invalid_body' });
    return;
  }
  const result = createReservation(order_id, sku, qty);
  if (result.error === 'unknown_sku') {
    send(req, res, 404, { error: 'unknown_sku' });
    return;
  }
  if (result.error === 'insufficient_stock') {
    send(req, res, 409, { error: 'insufficient_stock', available: result.available });
    return;
  }
  send(req, res, 201, result.reservation);
});

inventory.get('/reservations', (req, res) => {
  const orderId = req.query.order_id;
  if (!orderId) {
    send(req, res, 400, { error: 'order_id_required' });
    return;
  }
  send(req, res, 200, { reservations: listReservationsByOrder(orderId) });
});

inventory.get('/reservations/:id', (req, res) => {
  const reservation = getReservation(req.params.id);
  if (!reservation) {
    send(req, res, 404, { error: 'not_found' });
    return;
  }
  send(req, res, 200, reservation);
});

inventory.delete('/reservations/:id', (req, res) => {
  const result = releaseReservation(req.params.id);
  if (result.error === 'not_found') {
    send(req, res, 404, { error: 'not_found' });
    return;
  }
  send(req, res, 204, {});
});
