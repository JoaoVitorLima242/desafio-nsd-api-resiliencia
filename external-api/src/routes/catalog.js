// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { Router } from 'express';
import { send } from '../chaos.js';
import { getItem } from '../state.js';

export const catalog = Router();

catalog.get('/items/:sku', (req, res) => {
  const item = getItem(req.params.sku);
  if (!item) {
    send(req, res, 404, { error: 'not_found' });
    return;
  }
  send(req, res, 200, {
    sku: item.sku,
    name: item.name,
    price_cents: item.price_cents,
    currency: item.currency,
    updated_at: item.updated_at,
  });
});
