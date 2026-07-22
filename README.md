# Desafio de Resiliência — Ambiente

> Esta rota funciona quando tudo dá certo; faça ela funcionar quando não dá.

Este repositório é o **ambiente** de um desafio técnico sobre **resiliência a
dependências externas**. Ele entrega uma API de pedidos (`api/`) que resolve o
caminho feliz e depende de um parceiro externo (`external-api/`) para reservar
estoque, autorizar pagamento, notificar e rastrear.

O desafio **não** é consertar bugs pontuais. É reprojetar o lado de cá para que o
sistema continue **correto e útil** mesmo quando o parceiro não coopera — decidindo
o que preservar, o que adiar e o que sacrificar. Como fazer isso é o trabalho do
participante.

---

## Subir o ambiente

Requer apenas Docker (com Compose v2+).

```bash
docker compose up --build
```

Sobe três serviços:

| Serviço        | Porta | O que é                                             |
|----------------|-------|-----------------------------------------------------|
| `api`          | 3000  | API de pedidos (TypeScript) — o código do participante |
| `external-api` | 4000  | API do parceiro externo                             |
| `db`           | 5432  | Postgres 16 com o schema de pedidos                 |

Verificação rápida:

```bash
curl localhost:3000/health      # {"status":"ok"}
```

Para derrubar tudo (incluindo o volume do banco):

```bash
docker compose down -v
```

---

## Criar e testar um pedido

O contrato completo da API está em [`CONTRATO.md`](./CONTRATO.md). O essencial:

```bash
# cria um pedido
curl -X POST localhost:3000/orders \
  -H 'X-User-Id: u1' \
  -H 'Content-Type: application/json' \
  -d '{ "sku": "SKU-001", "qty": 2 }'

# consulta um pedido (enriquecido com preço atual e rastreio)
curl localhost:3000/orders/<ID> -H 'X-User-Id: u1'

# lista os pedidos do usuário
curl 'localhost:3000/orders?limit=20&offset=0' -H 'X-User-Id: u1'

# cancela um pedido
curl -X POST localhost:3000/orders/<ID>/cancel -H 'X-User-Id: u1'
```

O header `X-User-Id` identifica o usuário (ausente, assume-se `anonymous`). A API
do parceiro serve os SKUs `SKU-001` a `SKU-020`.

---

## O que é livre para alterar

- **`api/` — TUDO, inclusive o schema do banco (`db/init/`).** É aqui que o
  participante trabalha.

## O que NÃO pode ser alterado

- **`external-api/`** — a API do parceiro externo.
- **`harness/`** — o gerador de carga e o verificador da avaliação.
- **O contrato público da API** — rotas, campos e códigos de status descritos em
  [`CONTRATO.md`](./CONTRATO.md). Por baixo, mude o que quiser; a superfície pública
  permanece.

---

## Estrutura

```
api/            API de pedidos (TypeScript) — código do participante
external-api/   API do parceiro externo — não alterar
db/init/        Schema e seed do Postgres
harness/        Gerador de carga e verificador da avaliação — não alterar
CONTRATO.md     Contrato fixo da API do participante
PARCEIRO-API.md Referência da API do parceiro
```
