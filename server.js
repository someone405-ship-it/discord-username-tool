import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkUsername, checkMany } from './utils/check.js';
import { generate, PRESET_NAMES } from './utils/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const app = express();

const ENV_TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim() || null;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/presets', (_req, res) => {
  res.json({ presets: PRESET_NAMES });
});

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasEnvToken: Boolean(ENV_TOKEN)
  });
});

app.post('/api/generate', (req, res) => {
  try {
    const body = req.body || {};
    let presets = body.presets;
    if (!presets || !Array.isArray(presets) || !presets.length) {
      presets = [body.preset || '3L'];
    }
    presets = [...new Set(presets.map((p) => String(p).trim()).filter(Boolean))];
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 1000, 1), 50000);
    const per = Math.max(1, Math.ceil(limit / presets.length));
    const all = [];
    const seen = new Set();
    for (const p of presets) {
      const list = generate(p, per);
      for (const u of list) {
        if (!seen.has(u)) {
          seen.add(u);
          all.push(u);
        }
      }
    }
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const out = all.slice(0, limit);
    res.json({ ok: true, count: out.length, presets, usernames: out });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

function resolveToken(bodyToken) {
  const t = (bodyToken || '').trim();
  return t || ENV_TOKEN || null;
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

const port = process.env.PORT || config.webPort || 3847;
app.listen(port, () => {
  console.log(`Discord Username Tool → http://localhost:${port}`);
  console.log(`Env token: ${ENV_TOKEN ? 'set' : 'not set'}`);
});
