# Contrato da API de Pedidos

Este é o **contrato fixo** da API do participante (`api/`). As rotas, os campos e os
códigos de status descritos aqui **não podem mudar** — são a superfície pública
avaliada. Por baixo, o participante pode reprojetar tudo — a organização do código,
o schema do banco, os clientes do parceiro.

- Base URL: `http://localhost:3000`
- Autenticação: simplificada. Header **`X-User-Id`** identifica o usuário. Ausente,
  assume-se `anonymous`. O desafio não é sobre autenticação.
- Corpo das requisições e respostas: JSON.

---

## Objeto `Order`

```json
{
  "id": "e265cc0c-1733-4763-80f7-186a3097e4bc",
  "user_id": "u1",
  "sku": "SKU-001",
  "qty": 2,
  "unit_price_cents": 1000,
  "total_cents": 2000,
  "status": "confirmed",
  "reservation_id": "54eef131-20f3-4986-98ed-2593bcf35bba",
  "authorization_id": "43913333-fb3f-4e6d-8513-b1996f058138",
  "created_at": "2026-07-22T18:14:57.191Z",
  "updated_at": "2026-07-22T18:14:57.345Z"
}
```

`status` na implementação inicial: `pending` | `confirmed` | `cancelled`. Esses
valores são o ponto de partida; o que o participante fizer por baixo é livre, desde
que o comportamento público das rotas abaixo — campos e códigos de status —
permaneça o mesmo.

---

## `POST /orders`

Cria um pedido.

**Requisição**

```
POST /orders
X-User-Id: u1
Content-Type: application/json

{ "sku": "SKU-001", "qty": 2 }
```

**Respostas**

| Código | Quando                                              |
|--------|-----------------------------------------------------|
| `201`  | Pedido criado. Corpo: objeto `Order`.               |
| `400`  | Corpo inválido (`sku` ausente ou `qty` não inteiro > 0). |
| `500`  | Erro interno (na implementação ingênua, qualquer falha do parceiro cai aqui). |

```json
201
{ "id": "…", "sku": "SKU-001", "qty": 2, "status": "confirmed", … }
```

---

## `GET /orders/:id`

Retorna o pedido enriquecido com o **preço atual do catálogo** e o **rastreio**.

**Requisição**

```
GET /orders/e265cc0c-1733-4763-80f7-186a3097e4bc
X-User-Id: u1
```

**Respostas**

| Código | Quando                          |
|--------|---------------------------------|
| `200`  | Pedido encontrado (enriquecido).|
| `404`  | Pedido inexistente para o usuário. |
| `500`  | Erro interno.                   |

```json
200
{
  "id": "…", "sku": "SKU-001", "status": "confirmed", …,
  "catalog": { "current_price_cents": 1000, "currency": "BRL" },
  "shipment": { "order_id": "…", "status": "in_transit", "estimated_delivery": "P5D" }
}
```

---

## `GET /orders`

Lista paginada dos pedidos do usuário, mais recentes primeiro.

**Requisição**

```
GET /orders?limit=20&offset=0
X-User-Id: u1
```

`limit` (padrão 20, máx 100) e `offset` (padrão 0).

**Resposta**

```json
200
{ "orders": [ { …Order }, … ], "limit": 20, "offset": 0 }
```

---

## `POST /orders/:id/cancel`

Cancela o pedido: libera a reserva e estorna o pagamento.

**Requisição**

```
POST /orders/e265cc0c-…/cancel
X-User-Id: u1
```

**Respostas**

| Código | Quando                     |
|--------|----------------------------|
| `200`  | Pedido cancelado. Corpo: objeto `Order` com `status: "cancelled"`. |
| `404`  | Pedido inexistente para o usuário. |
| `500`  | Erro interno.              |

---

## `GET /health`

```
GET /health  ->  200  { "status": "ok" }
```

`200` enquanto o processo está de pé.
