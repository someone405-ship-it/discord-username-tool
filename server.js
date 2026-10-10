import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkUsername } from './utils/check.js';
import { claimUsername } from './utils/claim.js';
import { generate, PRESET_NAMES } from './utils/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const app = express();

const ENV_TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim() || null;
const ENV_PASSWORD = (process.env.DISCORD_PASSWORD || process.env.PASSWORD || '').trim() || null;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/presets', (_req, res) => res.json({ presets: PRESET_NAMES }));
app.get('/api/status', (_req, res) => {
  res.json({ ok: true, hasEnvToken: Boolean(ENV_TOKEN), hasEnvPassword: Boolean(ENV_PASSWORD) });
});

app.post('/api/generate', (req, res) => {
  try {
    const body = req.body || {};
    let presets = body.presets;
    if (!Array.isArray(presets) || !presets.length) presets = [body.preset || '3L'];
    presets = [...new Set(presets.map((p) => String(p).trim()).filter(Boolean))];
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 300, 1), 5000);
    const per = Math.max(1, Math.ceil(limit / presets.length));
    const all = [];
    const seen = new Set();
    for (const p of presets) {
      let list;
      try { list = generate(p, per); }
      catch (err) { return res.status(400).json({ ok: false, error: err.message, preset: p }); }
      for (const u of list) {
        if (!seen.has(u)) { seen.add(u); all.push(u); }
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

function resolveToken(t) {
  return ((t || '').trim() || ENV_TOKEN || null);
}
function resolvePassword(p) {
  if (p != null && String(p).trim()) return String(p);
  return ENV_PASSWORD || null;
}

app.post('/api/check-one', async (req, res) => {
  try {
    const { username, token = null } = req.body || {};
    if (!username) return res.status(400).json({ ok: false, error: 'username required' });
    const result = await checkUsername(String(username).trim(), resolveToken(token));
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
    if (!username) return res.status(400).json({ ok: false, error: 'username required' });
    if (!resolvedToken) return res.status(400).json({ ok: false, error: 'token missing' });
    if (!resolvedPassword) return res.status(400).json({ ok: false, error: 'password missing' });

    const check = await checkUsername(String(username).trim(), resolvedToken);
    if (check.status !== 'available') {
      return res.json({ ok: false, stage: 'check', check });
    }
    const claim = await claimUsername(String(username).trim(), resolvedToken, resolvedPassword);
    res.json({ ok: !!claim.success, stage: 'claim', check, claim });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || config.webPort || 3847;
app.listen(port, () => {
  console.log(`Discord Username Sniper → http://localhost:${port}`);
  console.log(`Env token: ${ENV_TOKEN ? 'set' : 'not set'} | password: ${ENV_PASSWORD ? 'set' : 'not set'}`);
});
