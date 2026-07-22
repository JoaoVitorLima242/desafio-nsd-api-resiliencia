export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Order {
  id: string;
  user_id: string;
  sku: string;
  qty: number;
  unit_price_cents: number | null;
  total_cents: number | null;
  status: OrderStatus;
  reservation_id: string | null;
  authorization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  sku: string;
  name: string;
  price_cents: number;
  currency: string;
  updated_at: string;
}

export interface Reservation {
  reservation_id: string;
  order_id: string;
  sku: string;
  qty: number;
  status: string;
  created_at: string;
}

export interface Authorization {
  authorization_id: string;
  order_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

export interface Shipment {
  order_id: string;
  status: string;
  estimated_delivery: string;
}
