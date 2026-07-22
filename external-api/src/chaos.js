// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { mulberry32 } from './rng.js';
import { record } from './calls.js';
import { driftPrice, state } from './state.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let profile = null;
let rnd = mulberry32(1);
let activatedAt = Date.now();
let rateWindows = new Map();
let driftTimer = null;

export function getProfile() {
  return profile;
}

export function activateProfile(next) {
  profile = next;
  rnd = mulberry32(next.seed >>> 0);
  activatedAt = Date.now();
  rateWindows = new Map();
  restartDrift();
}

function restartDrift() {
  if (driftTimer) {
    clearInterval(driftTimer);
    driftTimer = null;
  }
  const ms = profile?.groups?.catalog?.price_drift_ms ?? 0;
  if (ms > 0) {
    driftTimer = setInterval(() => {
      for (const sku of state.items.keys()) driftPrice(sku, rnd);
    }, ms);
    driftTimer.unref?.();
  }
}

export function stopChaos() {
  if (driftTimer) clearInterval(driftTimer);
  driftTimer = null;
}

function inOutage(group) {
  const windows = profile.groups[group]?.outage_windows ?? [];
  const elapsed = Date.now() - activatedAt;
  return windows.some((w) => elapsed >= w.start_ms && elapsed < w.start_ms + w.duration_ms);
}

function checkRate(key, cfg) {
  if (!cfg) return { limited: false };
  const now = Date.now();
  let w = rateWindows.get(key);
  if (!w || now - w.windowStart >= cfg.window_ms) {
    w = { count: 0, windowStart: now };
    rateWindows.set(key, w);
  }
  w.count++;
  if (w.count > cfg.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((w.windowStart + cfg.window_ms - now) / 1000));
    return { limited: true, retryAfterSec };
  }
  return { limited: false };
}

function latencyFor(group) {
  const l = profile.groups[group].latency;
  let ms = l.base_ms + rnd() * l.jitter_ms;
  if (rnd() < l.p99_rate) ms = Math.max(ms, l.p99_ms);
  return ms;
}

function finish(req, res, group, t0, status, body, outcome, headers) {
  if (headers) for (const [k, v] of Object.entries(headers)) res.set(k, v);
  record({
    method: req.method,
    path: req.baseUrl + req.path,
    group,
    status,
    outcome,
    latency_ms: Date.now() - t0,
    idempotency_key: req.header?.('Idempotency-Key') ?? null,
    order_id: req.body?.order_id ?? req.query?.order_id ?? null,
  });
  res.status(status).json(body);
}

export function chaos(group) {
  return async (req, res, next) => {
    const t0 = Date.now();
    req._chaos = { group, t0, ambiguous: false };

    if (!profile) {
      next();
      return;
    }

    if (inOutage(group)) {
      finish(req, res, group, t0, 503, { error: 'service_unavailable' }, 'unavailable');
      return;
    }

    const g = checkRate('__global__', profile.global_rate_limit);
    if (g.limited) {
      finish(req, res, group, t0, 429, { error: 'rate_limited', scope: 'global' }, 'rate_limited', {
        'Retry-After': String(g.retryAfterSec),
      });
      return;
    }

    const gr = checkRate(`group:${group}`, profile.groups[group].rate_limit);
    if (gr.limited) {
      finish(req, res, group, t0, 429, { error: 'rate_limited', scope: group }, 'rate_limited', {
        'Retry-After': String(gr.retryAfterSec),
      });
      return;
    }

    await sleep(latencyFor(group));

    if (rnd() < profile.groups[group].error_rate) {
      finish(req, res, group, t0, 500, { error: 'internal_error' }, 'error');
      return;
    }

    req._chaos.ambiguous = rnd() < profile.groups[group].timeout_ambiguous_rate;

    next();
  };
}

export function send(req, res, status, body, meta = {}) {
  const c = req._chaos ?? { group: 'unknown', t0: Date.now(), ambiguous: false };
  const latency = Date.now() - c.t0;
  const base = {
    method: req.method,
    path: req.baseUrl + req.path,
    group: c.group,
    latency_ms: latency,
    idempotency_key: meta.idempotency_key ?? req.header?.('Idempotency-Key') ?? null,
    order_id: meta.order_id ?? req.body?.order_id ?? req.query?.order_id ?? null,
  };

  if (c.ambiguous) {
    record({ ...base, status, outcome: 'ambiguous_timeout' });
    if (res.socket) res.socket.destroy();
    return;
  }

  record({ ...base, status, outcome: status >= 500 ? 'error' : 'ok' });
  if (status === 204) {
    res.status(204).end();
    return;
  }
  res.status(status).json(body);
}
