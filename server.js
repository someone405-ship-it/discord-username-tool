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

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/presets', (_req, res) => {
  res.json({ presets: PRESET_NAMES });
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

app.post('/api/check', async (req, res) => {
  try {
    const { usernames = [], token = null } = req.body || {};
    if (!Array.isArray(usernames) || !usernames.length) {
      return res.status(400).json({ ok: false, error: 'usernames array required' });
    }
    const capped = usernames.map((u) => String(u).trim()).filter(Boolean).slice(0, 500);
    const results = await checkMany(capped, {
      token: token || null,
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
    const result = await checkUsername(username, token);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/claim', async (req, res) => {
  try {
    const { username, token, password } = req.body || {};
    if (!username || !token || !password) {
      return res.status(400).json({ ok: false, error: 'username, token, and password required' });
    }
    const check = await checkUsername(username, token);
    if (check.status !== 'available') {
      return res.json({ ok: false, stage: 'check', check });
    }
    const result = await claimUsername(username, token, password);
    res.json({ ok: !!result.success, stage: 'claim', check, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || config.webPort || 3847;
app.listen(port, () => {
  console.log(`Discord Username Tool → http://localhost:${port}`);
});
