import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkUsername, checkMany } from './utils/check.js';
import { claimUsername } from './utils/claim.js';
import { generate, PRESET_NAMES } from './utils/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const app = express();

// Render / local env — never log token values
const ENV_TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim() || null;
const ENV_PASSWORD = (process.env.DISCORD_PASSWORD || process.env.PASSWORD || '').trim() || null;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/presets', (_req, res) => {
  res.json({ presets: PRESET_NAMES });
});

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasEnvToken: Boolean(ENV_TOKEN),
    hasEnvPassword: Boolean(ENV_PASSWORD)
  });
});

app.post('/api/generate', (req, res) => {
  try {
    const { preset = '3L', limit = 1500 } = req.body || {};
    const capped = Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 50000);
    const list = generate(String(preset), capped);
    res.json({ ok: true, count: list.length, usernames: list });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

function resolveToken(bodyToken) {
  const t = (bodyToken || '').trim();
  return t || ENV_TOKEN || null;
}

function resolvePassword(bodyPassword) {
  const p = bodyPassword != null ? String(bodyPassword) : '';
  if (p.trim()) return p;
  return ENV_PASSWORD || null;
}

app.post('/api/check', async (req, res) => {
  try {
    const { usernames = [], token = null } = req.body || {};
    if (!Array.isArray(usernames) || !usernames.length) {
      return res.status(400).json({ ok: false, error: 'usernames array required' });
    }
    const capped = usernames.map((u) => String(u).trim()).filter(Boolean).slice(0, 500);
    const results = await checkMany(capped, {
      token: resolveToken(token),
      concurrency: config.maxConcurrentChecks || 3,
      delayMs: config.delayBetweenChecksMs || 120
    });
    const summary = {
      available: results.filter((r) => r.status === 'available').length,
      taken: results.filter((r) => r.status === 'taken').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      error: results.filter((r) => r.status === 'error').length
    };
    res.json({ ok: true, summary, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/check-one', async (req, res) => {
  try {
    const { username, token = null } = req.body || {};
    if (!username) return res.status(400).json({ ok: false, error: 'username required' });
    const result = await checkUsername(username, resolveToken(token));
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/claim', async (req, res) => {
  try {
    const { username, token, password } = req.body || {};
    const resolvedToken = resolveToken(token);
    const resolvedPassword = resolvePassword(password);

    if (!username) {
      return res.status(400).json({ ok: false, error: 'username required' });
    }
    if (!resolvedToken) {
      return res.status(400).json({
        ok: false,
        error: 'token required — set DISCORD_TOKEN on Render or paste token in the UI'
      });
    }
    if (!resolvedPassword) {
      return res.status(400).json({
        ok: false,
        error: 'password required — set DISCORD_PASSWORD on Render or paste password in the UI'
      });
    }

    // Always re-check live — never claim if taken
    const check = await checkUsername(username, resolvedToken);
    if (check.status !== 'available') {
      return res.json({ ok: false, stage: 'check', check });
    }

    const result = await claimUsername(username, resolvedToken, resolvedPassword);
    res.json({ ok: !!result.success, stage: 'claim', check, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || config.webPort || 3847;
app.listen(port, () => {
  console.log(`Discord Username Tool → http://localhost:${port}`);
  console.log(`Env token: ${ENV_TOKEN ? 'set' : 'not set'} | Env password: ${ENV_PASSWORD ? 'set' : 'not set'}`);
});
