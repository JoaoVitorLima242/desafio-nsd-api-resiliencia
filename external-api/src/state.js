// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { randomUUID } from 'node:crypto';

function seedCatalog() {
  const items = new Map();
  const names = [
    'Teclado', 'Mouse', 'Monitor', 'Webcam', 'Headset',
    'Cadeira', 'Mesa', 'Suporte', 'Cabo HDMI', 'Hub USB',
    'SSD 1TB', 'Memória 16GB', 'Placa de Vídeo', 'Fonte 650W', 'Gabinete',
    'Cooler', 'Notebook', 'Caneta 3D', 'Dock Raro', 'Item Escasso',
  ];
  const stocks = [
    500, 500, 300, 400, 350,
    120, 90, 800, 1000, 600,
    250, 300, 60, 150, 110,
    400, 40, 5, 3, 2,
  ];
  for (let i = 0; i < 20; i++) {
    const n = String(i + 1).padStart(3, '0');
    const sku = `SKU-${n}`;
    items.set(sku, {
      sku,
      name: names[i],
      price_cents: 1000 + i * 500,
      currency: 'BRL',
      stock: stocks[i],
      updated_at: new Date().toISOString(),
    });
  }
  return items;
}

function seedPriceHistory(items) {
  const history = new Map();
  const now = new Date().toISOString();
  for (const item of items.values()) {
    history.set(item.sku, [
      { sku: item.sku, price_cents: item.price_cents, from: now, to: null },
    ]);
  }
  return history;
}

export const state = {
  items: new Map(),
  priceHistory: new Map(),
  reservations: new Map(),
  authorizations: new Map(),
  idempotency: new Map(),
};

export function resetState() {
  state.items = seedCatalog();
  state.priceHistory = seedPriceHistory(state.items);
  state.reservations = new Map();
  state.authorizations = new Map();
  state.idempotency = new Map();
}

export function getItem(sku) {
  return state.items.get(sku) ?? null;
}

export function driftPrice(sku, rnd) {
  const item = state.items.get(sku);
  if (!item) return;
  const factor = 1 + (rnd() * 0.1 - 0.05);
  const newPrice = Math.max(1, Math.round(item.price_cents * factor));
  const now = new Date().toISOString();

  item.price_cents = newPrice;
  item.updated_at = now;

  const hist = state.priceHistory.get(sku);
  const last = hist[hist.length - 1];
  if (last) last.to = now;
  hist.push({ sku, price_cents: newPrice, from: now, to: null });
}

export function createReservation(orderId, sku, qty) {
  const item = state.items.get(sku);
  if (!item) return { error: 'unknown_sku' };
  if (item.stock - qty < 0) {
    return { error: 'insufficient_stock', available: item.stock };
  }
  item.stock -= qty;
  const reservation = {
    reservation_id: randomUUID(),
    order_id: orderId,
    sku,
    qty,
    status: 'reserved',
    created_at: new Date().toISOString(),
  };
  state.reservations.set(reservation.reservation_id, reservation);
  return { reservation };
}

export function getReservation(id) {
  return state.reservations.get(id) ?? null;
}

export function listReservationsByOrder(orderId) {
  return [...state.reservations.values()].filter((r) => r.order_id === orderId);
}

export function releaseReservation(id) {
  const reservation = state.reservations.get(id);
  if (!reservation) return { error: 'not_found' };
  const item = state.items.get(reservation.sku);
  if (item) item.stock += reservation.qty;
  state.reservations.delete(id);
  return { ok: true };
}

export function createAuthorization(orderId, amountCents, currency, idempotencyKey) {
  if (idempotencyKey && state.idempotency.has(idempotencyKey)) {
    const existingId = state.idempotency.get(idempotencyKey);
    return { authorization: state.authorizations.get(existingId), replayed: true };
  }
  const authorization = {
    authorization_id: randomUUID(),
    order_id: orderId,
    amount_cents: amountCents,
    currency,
    status: 'authorized',
    created_at: new Date().toISOString(),
  };
  state.authorizations.set(authorization.authorization_id, authorization);
  if (idempotencyKey) state.idempotency.set(idempotencyKey, authorization.authorization_id);
  return { authorization, replayed: false };
}

export function getAuthorization(id) {
  return state.authorizations.get(id) ?? null;
}

export function listAuthorizationsByOrder(orderId) {
  return [...state.authorizations.values()].filter((a) => a.order_id === orderId);
}

export function refundAuthorization(id) {
  const auth = state.authorizations.get(id);
  if (!auth) return { error: 'not_found' };
  if (auth.status === 'refunded') return { error: 'already_refunded' };
  auth.status = 'refunded';
  return {
    refund: {
      refund_id: randomUUID(),
      authorization_id: id,
      status: 'refunded',
    },
  };
}

export function snapshot() {
  return {
    stock: [...state.items.values()].map((i) => ({ sku: i.sku, stock: i.stock, price_cents: i.price_cents })),
    reservations: [...state.reservations.values()],
    authorizations: [...state.authorizations.values()],
    price_history: [...state.priceHistory.values()].flat(),
  };
}

resetState();
