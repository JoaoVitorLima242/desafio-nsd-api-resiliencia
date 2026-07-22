-- Schema da API de pedidos.
-- Estados usados pela implementação inicial: 'pending', 'confirmed', 'cancelled'.
-- O participante provavelmente precisará de estados intermediários — o schema pode
-- ser alterado por ele. Este é apenas o ponto de partida ingênuo.

CREATE TABLE orders (
  id               UUID PRIMARY KEY,
  user_id          TEXT NOT NULL,
  sku              TEXT NOT NULL,
  qty              INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER,
  total_cents      INTEGER,
  status           TEXT NOT NULL,
  reservation_id   TEXT,
  authorization_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders (status);
