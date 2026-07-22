// Harness de avaliação — parte FIXA do desafio. NÃO alterar.

import { readFileSync, writeFileSync } from 'node:fs';

const API = process.env.API_BASE_URL ?? 'http://localhost:3000';
const PARTNER = process.env.PARTNER_BASE_URL ?? 'http://localhost:4000';

const args = process.argv.slice(2);
const scenarioPath = args.find((a) => !a.startsWith('--')) ?? './scenarios/dev.json';
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(scenario.seed ?? 1234);

function pickWeighted(list) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let r = rnd() * total;
  for (const x of list) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const createdIds = [];
const results = [];
let apiRequests = 0;

async function timed(op, fn) {
  const t0 = Date.now();
  let status = 0;
  let ok = false;
  try {
    status = await fn();
    ok = status >= 200 && status < 300;
  } catch {
    status = 0;
    ok = false;
  }
  const ms = Date.now() - t0;
  results.push({ op, status, ms, ok });
  apiRequests++;
}

async function createOrder() {
  const sku = pickWeighted(scenario.skus).sku;
  const qty = 1 + Math.floor(rnd() * (scenario.qty_max ?? 3));
  await timed('create_order', async () => {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': scenario.user_id ?? 'harness' },
      body: JSON.stringify({ sku, qty }),
    });
    if (res.status === 201) {
      const body = await res.json();
      if (body?.id) createdIds.push(body.id);
    } else {
      await res.text().catch(() => {});
    }
    return res.status;
  });
}

async function getOrder() {
  if (createdIds.length === 0) return createOrder();
  const id = createdIds[Math.floor(rnd() * createdIds.length)];
  await timed('get_order', async () => {
    const res = await fetch(`${API}/orders/${id}`, {
      headers: { 'X-User-Id': scenario.user_id ?? 'harness' },
    });
    await res.text().catch(() => {});
    return res.status;
  });
}

async function cancelOrder() {
  if (createdIds.length === 0) return createOrder();
  const id = createdIds[Math.floor(rnd() * createdIds.length)];
  await timed('cancel_order', async () => {
    const res = await fetch(`${API}/orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'X-User-Id': scenario.user_id ?? 'harness' },
    });
    await res.text().catch(() => {});
    return res.status;
  });
}

const OPS = { create_order: createOrder, get_order: getOrder, cancel_order: cancelOrder };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function worker(deadline) {
  const think = scenario.think_time_ms ?? 0;
  while (Date.now() < deadline) {
    const op = pickWeighted(scenario.mix).op;
    await OPS[op]();

    if (think > 0) await sleep(think);
  }
}

async function partnerStats() {
  try {
    const res = await fetch(`${PARTNER}/_control/stats`);
    return await res.json();
  } catch {
    return null;
  }
}

async function partnerCalls() {
  try {
    const res = await fetch(`${PARTNER}/_control/calls`);
    const body = await res.json();
    return body.calls ?? [];
  } catch {
    return [];
  }
}

function recoveryAfterOutages(calls) {
  if (calls.length === 0) return [];
  const bySecond = new Map();
  let minSec = Infinity;
  let maxSec = -Infinity;
  for (const c of calls) {
    const sec = Math.floor(Date.parse(c.ts) / 1000);
    minSec = Math.min(minSec, sec);
    maxSec = Math.max(maxSec, sec);
    const b = bySecond.get(sec) ?? { total: 0, unavailable: 0 };
    b.total++;
    if (c.status === 503) b.unavailable++;
    bySecond.set(sec, b);
  }

  const outageSecs = [];
  for (let s = minSec; s <= maxSec; s++) {
    if ((bySecond.get(s)?.unavailable ?? 0) > 0) outageSecs.push(s);
  }
  if (outageSecs.length === 0) return [];

  const clusters = [];
  let start = outageSecs[0];
  let prev = outageSecs[0];
  for (let i = 1; i < outageSecs.length; i++) {
    if (outageSecs[i] - prev > 2) {
      clusters.push({ start, end: prev });
      start = outageSecs[i];
    }
    prev = outageSecs[i];
  }
  clusters.push({ start, end: prev });

  return clusters.map((cl) => {
    let calls30s = 0;
    for (let s = cl.end + 1; s <= cl.end + 30; s++) calls30s += bySecond.get(s)?.total ?? 0;
    return {
      outage_end_offset_s: cl.end - minSec,
      calls_next_30s: calls30s,
      calls_per_sec_next_30s: +(calls30s / 30).toFixed(2),
    };
  });
}

async function main() {
  console.log(`carga: cenário=${scenarioPath} conc=${scenario.concurrency} dur=${scenario.duration_ms}ms`);
  console.log(`API=${API} PARTNER=${PARTNER}`);

  const before = await partnerStats();
  const beforeTotal = before?.total ?? 0;

  const start = Date.now();
  const deadline = start + scenario.duration_ms;
  const workers = Array.from({ length: scenario.concurrency }, () => worker(deadline));
  await Promise.all(workers);
  const wallMs = Date.now() - start;

  const after = await partnerStats();
  const afterTotal = after?.total ?? 0;
  const calls = await partnerCalls();

  const byOp = {};
  const byStatus = {};
  for (const r of results) {
    const o = (byOp[r.op] ??= { count: 0, ok: 0, latencies: [] });
    o.count++;
    if (r.ok) o.ok++;
    o.latencies.push(r.ms);
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const routes = {};
  for (const [op, o] of Object.entries(byOp)) {
    const sorted = o.latencies.slice().sort((a, b) => a - b);
    routes[op] = {
      count: o.count,
      success: o.ok,
      error: o.count - o.ok,
      p50_ms: percentile(sorted, 50),
      p95_ms: percentile(sorted, 95),
      p99_ms: percentile(sorted, 99),
    };
  }

  let rl429 = 0;
  let un503 = 0;
  let ambiguous = 0;
  for (const g of Object.values(after?.groups ?? {})) {
    rl429 += g.rate_limited_429 ?? 0;
    un503 += g.unavailable_503 ?? 0;
    ambiguous += g.ambiguous_timeouts ?? 0;
  }

  const partnerCallsDelta = afterTotal - beforeTotal;
  const amplification = apiRequests > 0 ? +(partnerCallsDelta / apiRequests).toFixed(3) : 0;

  const report = {
    scenario: scenarioPath,
    wall_ms: wallMs,
    api_requests: apiRequests,
    requests_by_status: byStatus,
    routes,
    partner: {
      calls_received: partnerCallsDelta,
      amplification_factor: amplification,
      rate_limited_429: rl429,
      unavailable_503: un503,
      ambiguous_timeouts: ambiguous,
    },
    recovery_after_outages: recoveryAfterOutages(calls),
  };

  console.log('\n===== RELATÓRIO DE CARGA =====');
  console.log(`duração real: ${(wallMs / 1000).toFixed(1)}s | requisições à API: ${apiRequests}`);
  console.log('por status:', JSON.stringify(byStatus));
  console.log('\npor rota:');
  for (const [op, r] of Object.entries(routes)) {
    console.log(
      `  ${op.padEnd(13)} n=${String(r.count).padStart(5)} ok=${String(r.success).padStart(5)} ` +
        `err=${String(r.error).padStart(5)} p50=${r.p50_ms}ms p95=${r.p95_ms}ms p99=${r.p99_ms}ms`,
    );
  }
  console.log('\nparceiro:');
  console.log(`  chamadas recebidas: ${partnerCallsDelta}`);
  console.log(`  fator de amplificação (parceiro/API): ${amplification}`);
  console.log(`  429 (rate limit): ${rl429} | 503 (indisponível): ${un503} | timeouts ambíguos: ${ambiguous}`);
  if (report.recovery_after_outages.length) {
    console.log('\nrecuperação após indisponibilidade:');
    for (const r of report.recovery_after_outages) {
      console.log(`  fim@+${r.outage_end_offset_s}s -> ${r.calls_per_sec_next_30s} chamadas/s nos 30s seguintes`);
    }
  }
  console.log('==============================\n');

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`relatório salvo em ${outPath}`);
  }
}

main().catch((err) => {
  console.error('erro na carga:', err);
  process.exit(1);
});
