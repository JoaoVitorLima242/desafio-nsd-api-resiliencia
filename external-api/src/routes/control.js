// Simulador do parceiro externo — parte FIXA do desafio. NÃO alterar.

import { Router } from 'express';
import { activateProfile, getProfile } from '../chaos.js';
import { validateProfile } from '../profile.js';
import { resetState, snapshot } from '../state.js';
import * as calls from '../calls.js';

export const control = Router();

control.get('/_control/profile', (_req, res) => {
  res.status(200).json(getProfile());
});

control.put('/_control/profile', (req, res) => {
  try {
    const profile = validateProfile(req.body);
    activateProfile(profile);
    res.status(200).json({ ok: true, profile });
  } catch (err) {
    res.status(400).json({ error: 'invalid_profile', detail: err.message });
  }
});

control.post('/_control/reset', (_req, res) => {
  resetState();
  calls.reset();
  res.status(200).json({ ok: true });
});

control.get('/_control/calls', (req, res) => {
  res.status(200).json({ calls: calls.since(req.query.since) });
});

control.get('/_control/stats', (_req, res) => {
  res.status(200).json(calls.stats());
});

control.get('/_control/state', (_req, res) => {
  res.status(200).json(snapshot());
});
