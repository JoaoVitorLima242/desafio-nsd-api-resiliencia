// Harness de avaliação — parte FIXA do desafio. NÃO alterar.

import { writeFileSync } from 'node:fs';

const API = process.env.API_BASE_URL ?? 'http://localhost:3000';
const PARTNER = process.env.PARTNER_BASE_URL ?? 'http://localhost:4000';

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}
const outPath = flag('--out', null);
const settleMs = Number(flag('--settle', '0'));
const userId = flag('--user', process.env.VERIFY_USER_ID ?? 'harness');

const FINAL_STATES = new Set(['confirmed', 'cancelled']);

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchAllOrders() {
  const limit = 100;
  let offset = 0;
  const all = [];
  for (;;) {
    const body = await getJson(`${API}/orders?limit=${limit}&offset=${offset}`, {
      headers: { 'X-User-Id': userId },
    });
    const batch = body.orders ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

function groupBy(list, key) {
  const m = new Map();
  for (const x of list) {
    const k = x[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

async function main() {
  if (settleMs > 0) {
    console.log(`aguardando quiescência de ${settleMs}ms...`);
    await new Promise((r) => setTimeout(r, settleMs));
  }

  const orders = await fetchAllOrders();
  const state = await getJson(`${PARTNER}/_control/state`);

  const resByOrder = groupBy(state.reservations, 'order_id');
  const authByOrder = groupBy(state.authorizations, 'order_id');
  const priceBySku = groupBy(state.price_history, 'sku');

  const violations = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  for (const [orderId, auths] of authByOrder) {
    const active = auths.filter((a) => a.status !== 'refunded');
    if (active.length > 1) {
      violations[1].push({ order_id: orderId, active_authorizations: active.length });
    }
  }

  const ordersById = new Map(orders.map((o) => [o.id, o]));
  for (const [orderId, reservations] of resByOrder) {
    const order = ordersById.get(orderId);
    if (!order) {
      violations[2].push({ order_id: orderId, reason: 'reserva ativa sem pedido correspondente' });
    } else if (order.status !== 'confirmed') {
      violations[2].push({
        order_id: orderId,
        order_status: order.status,
        active_reservations: reservations.length,
        reason: `reserva ativa em pedido '${order.status}'`,
      });
    }
  }

  for (const s of state.stock) {
    if (s.stock < 0) violations[3].push({ sku: s.sku, stock: s.stock });
  }

  for (const o of orders) {
    if (o.status !== 'confirmed' || o.unit_price_cents == null) continue;
    const history = priceBySku.get(o.sku) ?? [];
    const known = history.some((h) => h.price_cents === o.unit_price_cents);
    if (!known) {
      violations[4].push({ order_id: o.id, sku: o.sku, unit_price_cents: o.unit_price_cents });
    }
  }

  for (const o of orders) {
    if (o.status === 'confirmed') {
      const hasRes = (resByOrder.get(o.id) ?? []).length > 0;
      const hasAuth = (authByOrder.get(o.id) ?? []).some((a) => a.status !== 'refunded');
      if (!hasRes || !hasAuth) {
        violations[5].push({
          order_id: o.id,
          status: 'confirmed',
          has_active_reservation: hasRes,
          has_active_authorization: hasAuth,
          reason: 'confirmado sem reserva e/ou autorização ativas no parceiro',
        });
      }
    } else if (o.status === 'cancelled') {
      const hasRes = (resByOrder.get(o.id) ?? []).length > 0;
      const hasAuth = (authByOrder.get(o.id) ?? []).some((a) => a.status !== 'refunded');
      if (hasRes || hasAuth) {
        violations[5].push({
          order_id: o.id,
          status: 'cancelled',
          has_active_reservation: hasRes,
          has_active_authorization: hasAuth,
          reason: 'cancelado com reserva e/ou autorização ainda ativas',
        });
      }
    }
  }

  for (const o of orders) {
    if (!FINAL_STATES.has(o.status)) {
      violations[6].push({ order_id: o.id, status: o.status });
    }
  }

  const titles = {
    1: 'Sem cobrança duplicada',
    2: 'Sem reserva órfã',
    3: 'Estoque não negativo',
    4: 'Sem dado fabricado',
    5: 'Estados finais coerentes',
    6: 'Sem pedido preso',
  };

  console.log('\n===== VERIFICAÇÃO DE INVARIANTES =====');
  console.log(`pedidos analisados: ${orders.length} (usuário=${userId})`);
  let failed = 0;
  const summary = {};
  for (const k of [1, 2, 3, 4, 5, 6]) {
    const v = violations[k];
    const pass = v.length === 0;
    if (!pass) failed++;
    summary[k] = { title: titles[k], pass, violations: v.length };
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${k}. ${titles[k]}${pass ? '' : ` — ${v.length} violação(ões)`}`);
    if (!pass) {
      for (const item of v.slice(0, 5)) console.log(`         · ${JSON.stringify(item)}`);
      if (v.length > 5) console.log(`         · ... (+${v.length - 5})`);
    }
  }
  console.log(`\nresultado: ${failed === 0 ? 'TODOS OS INVARIANTES OK' : `${failed} invariante(s) violado(s)`}`);
  console.log('======================================\n');

  const report = { user_id: userId, orders_analyzed: orders.length, summary, violations, failed };
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`relatório salvo em ${outPath}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('erro na verificação:', err);
  process.exit(2);
});
