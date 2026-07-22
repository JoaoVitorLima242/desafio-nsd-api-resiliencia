// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { readFileSync } from 'node:fs';

const GROUPS = ['catalog', 'inventory', 'payments', 'notifications', 'shipments'];

function fail(msg) {
  const err = new Error(msg);
  err.validation = true;
  return err;
}

function validateLatency(l, where) {
  if (!l || typeof l !== 'object') throw fail(`${where}.latency ausente`);
  for (const k of ['base_ms', 'jitter_ms', 'p99_ms', 'p99_rate']) {
    if (typeof l[k] !== 'number' || l[k] < 0) throw fail(`${where}.latency.${k} inválido`);
  }
}

export function validateProfile(p) {
  if (!p || typeof p !== 'object') throw fail('perfil não é um objeto');
  if (typeof p.seed !== 'number') throw fail('seed obrigatório (número)');

  if (p.global_rate_limit !== null && p.global_rate_limit !== undefined) {
    const g = p.global_rate_limit;
    if (typeof g.limit !== 'number' || typeof g.window_ms !== 'number') {
      throw fail('global_rate_limit inválido');
    }
  }

  if (!p.groups || typeof p.groups !== 'object') throw fail('groups ausente');
  for (const name of GROUPS) {
    const g = p.groups[name];
    if (!g) throw fail(`grupo ${name} ausente`);
    if (typeof g.error_rate !== 'number' || g.error_rate < 0 || g.error_rate > 1) {
      throw fail(`${name}.error_rate inválido`);
    }
    validateLatency(g.latency, name);
    if (typeof g.timeout_ambiguous_rate !== 'number' || g.timeout_ambiguous_rate < 0 || g.timeout_ambiguous_rate > 1) {
      throw fail(`${name}.timeout_ambiguous_rate inválido`);
    }
    if (g.rate_limit !== null && g.rate_limit !== undefined) {
      if (typeof g.rate_limit.limit !== 'number' || typeof g.rate_limit.window_ms !== 'number') {
        throw fail(`${name}.rate_limit inválido`);
      }
    }
    if (!Array.isArray(g.outage_windows)) throw fail(`${name}.outage_windows deve ser array`);
    for (const w of g.outage_windows) {
      if (typeof w.start_ms !== 'number' || typeof w.duration_ms !== 'number') {
        throw fail(`${name}.outage_windows contém janela inválida`);
      }
    }
  }
  return p;
}

export function loadProfileFromFile(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  return validateProfile(parsed);
}

export { GROUPS };
