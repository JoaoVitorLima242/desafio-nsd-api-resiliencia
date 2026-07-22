import type {
  Authorization,
  CatalogItem,
  Reservation,
  Shipment,
} from './types.js';

const BASE_URL = process.env.PARTNER_BASE_URL ?? 'http://localhost:4000';

class PartnerError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`partner responded ${status}`);
    this.name = 'PartnerError';
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new PartnerError(res.status, body);
  }
  return body as T;
}

export async function getCatalogItem(sku: string): Promise<CatalogItem> {
  const res = await fetch(`${BASE_URL}/catalog/items/${encodeURIComponent(sku)}`);
  return parse<CatalogItem>(res);
}

export async function createReservation(
  orderId: string,
  sku: string,
  qty: number,
): Promise<Reservation> {
  const res = await fetch(`${BASE_URL}/inventory/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, sku, qty }),
  });
  return parse<Reservation>(res);
}

export async function deleteReservation(reservationId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/inventory/reservations/${encodeURIComponent(reservationId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    throw new PartnerError(res.status, await res.json().catch(() => null));
  }
}

export async function createAuthorization(
  orderId: string,
  amountCents: number,
  currency: string,
): Promise<Authorization> {
  const res = await fetch(`${BASE_URL}/payments/authorizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: orderId,
      amount_cents: amountCents,
      currency,
    }),
  });
  return parse<Authorization>(res);
}

export async function refundAuthorization(authorizationId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/payments/authorizations/${encodeURIComponent(authorizationId)}/refund`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new PartnerError(res.status, await res.json().catch(() => null));
  }
}

export async function sendNotification(
  orderId: string,
  channel: string,
  message: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, channel, message }),
  });
  await parse<{ notification_id: string }>(res);
}

export async function getShipment(orderId: string): Promise<Shipment | null> {
  const res = await fetch(`${BASE_URL}/shipments/${encodeURIComponent(orderId)}`);
  if (res.status === 404) return null;
  return parse<Shipment>(res);
}

export { PartnerError };
