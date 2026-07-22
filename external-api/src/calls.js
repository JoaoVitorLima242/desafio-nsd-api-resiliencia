// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

const calls = [];
const MAX = 200000;

export function record(entry) {
  calls.push({
    ts: new Date().toISOString(),
    method: entry.method,
    path: entry.path,
    group: entry.group,
    status: entry.status,
    outcome: entry.outcome,
    latency_ms: entry.latency_ms,
    idempotency_key: entry.idempotency_key ?? null,
    order_id: entry.order_id ?? null,
  });
  if (calls.length > MAX) calls.splice(0, calls.length - MAX);
}

export function since(iso) {
  if (!iso) return calls.slice();
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return calls.slice();
  return calls.filter((c) => Date.parse(c.ts) >= t);
}

export function reset() {
  calls.length = 0;
}

export function stats() {
  const groups = {};
  let total = 0;
  for (const c of calls) {
    total++;
    const g = (groups[c.group] ??= {
      total: 0,
      by_status: {},
      ambiguous_timeouts: 0,
      rate_limited_429: 0,
      unavailable_503: 0,
    });
    g.total++;
    g.by_status[c.status] = (g.by_status[c.status] ?? 0) + 1;
    if (c.outcome === 'ambiguous_timeout') g.ambiguous_timeouts++;
    if (c.status === 429) g.rate_limited_429++;
    if (c.status === 503) g.unavailable_503++;
  }
  return { total, groups };
}
