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

const ENV_TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim() || null;
const ENV_PASSWORD = (process.env.DISCORD_PASSWORD || process.env.PASSWORD || '').trim() || null;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/presets', (_req, res) => res.json({ presets: PRESET_NAMES }));
app.get('/api/status', (_req, res) => {
  res.json({ ok: true, hasEnvToken: Boolean(ENV_TOKEN), hasEnvPassword: Boolean(ENV_PASSWORD) });
});

app.post('/api/generate', (req, res) => {
  try {
    const body = req.body || {};
    let presets = body.presets;
    if (!Array.isArray(presets) || !presets.length) {
      presets = [body.preset || '3L'];
    }
    presets = [...new Set(presets.map((p) => String(p).trim()).filter(Boolean))];
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 500, 1), 10000);
    const per = Math.max(1, Math.ceil(limit / presets.length));
    const all = [];
    const seen = new Set();
    for (const p of presets) {
      let list;
      try {
        list = generate(p, per);
      } catch (err) {
        return res.status(400).json({ ok: false, error: err.message, preset: p });
      }
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

function resolveToken(t) {
  return ((t || '').trim() || ENV_TOKEN || null);
}
function resolvePassword(p) {
  if (p != null && String(p).trim()) return String(p);
  return ENV_PASSWORD || null;
}

app.post('/api/snipe', async (req, res) => {
  try {
    const { usernames = [], token, password, rps = 3, stopOnClaim = true } = req.body || {};
    const resolvedToken = resolveToken(token);
    const resolvedPassword = resolvePassword(password);
    if (!Array.isArray(usernames) || !usernames.length) {
      return res.status(400).json({ ok: false, error: 'usernames array required' });
    }
    if (!resolvedToken) {
      return res.status(400).json({ ok: false, error: 'token required — set DISCORD_TOKEN on Render or paste in UI' });
    }
    if (!resolvedPassword) {
      return res.status(400).json({ ok: false, error: 'password required — set DISCORD_PASSWORD on Render or paste in UI' });
    }

    const list = usernames.map((u) => String(u).trim().toLowerCase()).filter(Boolean).slice(0, 200);
    const safeRps = Math.min(10, Math.max(1, Number(rps) || 3));
    const delayMs = Math.max(100, Math.round(1000 / safeRps));
    const results = [];
    let claimed = null;

    for (const username of list) {
      const check = await checkUsername(username, resolvedToken);
      if (check.status === 'available') {
        const claim = await claimUsername(username, resolvedToken, resolvedPassword);
        const row = { username, status: claim.success ? 'claimed' : 'claim_failed', check, claim };
        results.push(row);
        if (claim.success) {
          claimed = username;
          if (stopOnClaim) break;
        }
      } else {
        results.push({ username, status: check.status, check });
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }

    res.json({
      ok: true,
      claimed,
      summary: {
        claimed: results.filter((r) => r.status === 'claimed').length,
        available_failed: results.filter((r) => r.status === 'claim_failed').length,
        taken: results.filter((r) => r.status === 'taken').length,
        invalid: results.filter((r) => r.status === 'invalid').length,
        error: results.filter((r) => r.status === 'error').length,
        checked: results.length
      },
      results
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || config.webPort || 3847;
app.listen(port, () => {
  console.log(`Discord Username Sniper → http://localhost:${port}`);
  console.log(`Env token: ${ENV_TOKEN ? 'set' : 'not set'} | password: ${ENV_PASSWORD ? 'set' : 'not set'}`);
});
