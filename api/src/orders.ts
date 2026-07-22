import { randomUUID } from 'node:crypto';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { query } from './db.js';
import * as partner from './partner.js';
import type { Order } from './types.js';

export const orders = Router();

const CURRENCY = 'BRL';

function userId(req: Request): string {
  return req.header('X-User-Id') ?? 'anonymous';
}

function h(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

orders.post('/orders', h(async (req: Request, res: Response) => {
  const { sku, qty } = req.body ?? {};
  if (typeof sku !== 'string' || !Number.isInteger(qty) || qty <= 0) {
    res.status(400).json({ error: 'invalid_body', detail: 'sku (string) e qty (int > 0) obrigatórios' });
    return;
  }

  const id = randomUUID();
  const user = userId(req);

  await query(
    `INSERT INTO orders (id, user_id, sku, qty, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [id, user, sku, qty],
  );

  const item = await partner.getCatalogItem(sku);
  const unitPrice = item.price_cents;
  const total = unitPrice * qty;

  const reservation = await partner.createReservation(id, sku, qty);

  const authorization = await partner.createAuthorization(id, total, CURRENCY);

  await partner.sendNotification(id, 'email', `Pedido ${id} confirmado`);

  const { rows } = await query<Order>(
    `UPDATE orders
        SET status = 'confirmed',
            unit_price_cents = $2,
            total_cents = $3,
            reservation_id = $4,
            authorization_id = $5,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, unitPrice, total, reservation.reservation_id, authorization.authorization_id],
  );

  res.status(201).json(rows[0]);
}));

orders.get('/orders/:id', h(async (req: Request, res: Response) => {
  const user = userId(req);
  const { rows } = await query<Order>(
    `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
    [req.params.id, user],
  );
  const order = rows[0];
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const item = await partner.getCatalogItem(order.sku);
  const shipment = await partner.getShipment(order.id);

  res.status(200).json({
    ...order,
    catalog: { current_price_cents: item.price_cents, currency: item.currency },
    shipment,
  });
}));

orders.get('/orders', h(async (req: Request, res: Response) => {
  const user = userId(req);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const { rows } = await query<Order>(
    `SELECT * FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [user, limit, offset],
  );

  res.status(200).json({ orders: rows, limit, offset });
}));

orders.post('/orders/:id/cancel', h(async (req: Request, res: Response) => {
  const user = userId(req);
  const { rows } = await query<Order>(
    `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
    [req.params.id, user],
  );
  const order = rows[0];
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  if (order.reservation_id) {
    await partner.deleteReservation(order.reservation_id);
  }
  if (order.authorization_id) {
    await partner.refundAuthorization(order.authorization_id);
  }

  const { rows: updated } = await query<Order>(
    `UPDATE orders SET status = 'cancelled', updated_at = now()
      WHERE id = $1 RETURNING *`,
    [order.id],
  );

  res.status(200).json(updated[0]);
}));
