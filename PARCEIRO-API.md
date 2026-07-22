# API do Parceiro Externo

Referência da API pública do parceiro. Todos os serviços são oferecidos pelo
mesmo host (`http://localhost:4000`): catálogo, estoque, pagamento, notificação e
rastreio.

---

## 1. Catálogo

| Rota | Resposta |
|------|----------|
| `GET /catalog/items/:sku` | `200 { sku, name, price_cents, currency, updated_at }` |
| | `404` se o SKU não existe |

Os campos `price_cents` e `updated_at` refletem o preço corrente do item. Preços
mudam ao longo do tempo — use `updated_at` para saber quando o valor foi observado.

SKUs disponíveis: **`SKU-001` a `SKU-020`**, com estoques variados.

---

## 2. Estoque

| Rota | Resposta |
|------|----------|
| `POST /inventory/reservations` `{order_id, sku, qty}` | `201 { reservation_id, order_id, sku, qty, status:"reserved", created_at }` |
| | `409 { error:"insufficient_stock", available }` se falta saldo |
| `GET /inventory/reservations?order_id=X` | `200 { reservations:[…] }` |
| `GET /inventory/reservations/:id` | `200` ou `404` |
| `DELETE /inventory/reservations/:id` | `204` (devolve o saldo); `404` se já removida |

Não aceita chave de idempotência: cada `POST` cria uma nova reserva e decrementa o
saldo. O saldo nunca fica negativo — uma reserva que levaria a negativo responde
`409`.

`GET …?order_id=X` devolve todas as reservas associadas a um pedido.

---

## 3. Pagamento

| Rota | Resposta |
|------|----------|
| `POST /payments/authorizations` `{order_id, amount_cents, currency}` | `201 { authorization_id, order_id, amount_cents, status:"authorized", created_at }` |
| `POST /payments/authorizations/:id/refund` | `201 { refund_id, authorization_id, status:"refunded" }`; `409` se já estornada |
| `GET /payments/authorizations?order_id=X` | `200 { authorizations:[…] }` |
| `GET /payments/authorizations/:id` | `200` ou `404` |

Aceita o header `Idempotency-Key`: repetir a mesma chave devolve a **mesma**
autorização, sem novo efeito. Sem a chave, cada chamada cria uma nova autorização.

`GET …?order_id=X` devolve todas as autorizações associadas a um pedido.

---

## 4. Notificação

| Rota | Resposta |
|------|----------|
| `POST /notifications` `{order_id, channel, message}` | `202 { notification_id }` |

---

## 5. Rastreio

| Rota | Resposta |
|------|----------|
| `GET /shipments/:order_id` | `200 { order_id, status, estimated_delivery }` |

---

## 6. Garantias — resumo

| Serviço      | Idempotência | Consulta por pedido |
|--------------|--------------|---------------------|
| Pagamento    | **Sim** (`Idempotency-Key`) | `GET /payments/authorizations?order_id=X` |
| Estoque      | **Não**      | `GET /inventory/reservations?order_id=X` |

Uma reserva pode ser desfeita (`DELETE /inventory/reservations/:id`) e uma
autorização pode ser estornada (`POST /payments/authorizations/:id/refund`).
