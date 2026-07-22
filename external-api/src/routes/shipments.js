// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { Router } from 'express';
import { send } from '../chaos.js';

export const shipments = Router();

const STATUSES = ['preparing', 'in_transit', 'out_for_delivery', 'delivered'];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

shipments.get('/:order_id', (req, res) => {
  const orderId = req.params.order_id;
  const h = hash(orderId);
  const status = STATUSES[h % STATUSES.length];
  const days = 1 + (h % 7);
  send(req, res, 200, {
    order_id: orderId,
    status,
    estimated_delivery: `P${days}D`,
  });
});
