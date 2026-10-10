import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

function buildHeaders(token) {
  const h = {
    'Content-Type': 'application/json',
    'User-Agent': config.userAgent,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Super-Properties': config.xSuperProperties,
    'X-Discord-Locale': 'en-US',
    Referer: 'https://discord.com/channels/@me',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Not.A/Brand";v="8", "Chromium";v="131"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'X-Debug-Options': 'bugReporterEnabled'
  };
  if (token) h.Authorization = token;
  return h;
}

export async function checkUsername(username, token = null) {
  const clean = String(username || '').trim().toLowerCase();
  if (clean.length < 2 || clean.length > 32) {
    return { status: 'invalid', username: clean, reason: 'length must be 2-32', ms: 0 };
  }
  if (/[@#:`]/.test(clean) || clean.includes('discord')) {
    return { status: 'invalid', username: clean, reason: 'forbidden characters or substring', ms: 0 };
  }
  const t0 = Date.now();
  try {
    const res = await axios.post(
      config.checkUrl,
      { username: clean },
      {
        headers: buildHeaders(token),
        timeout: config.checkTimeoutMs || 10000,
        validateStatus: () => true
      }
    );
    const ms = Date.now() - t0;
    if (res.status === 200 && res.data && typeof res.data.taken === 'boolean') {
      return res.data.taken === false
        ? { status: 'available', username: clean, raw: res.data, ms }
        : { status: 'taken', username: clean, raw: res.data, ms };
    }
    const msg =
      res.data?.message ||
      res.data?.errors?.username?.[0] ||
      (typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 160) : String(res.data || ''));
    if (res.status === 429) {
      const retry = Number(res.headers?.['retry-after'] || res.data?.retry_after || 2);
      return { status: 'error', username: clean, reason: 'rate limited \u2014 wait a bit', raw: res.data, ms, retryAfter: retry };
    }
    if (res.status === 400) {
      return { status: 'invalid', username: clean, reason: msg || 'bad request', raw: res.data, ms };
    }
    return { status: 'error', username: clean, reason: msg || `http ${res.status}`, raw: res.data, ms };
  } catch (err) {
    return { status: 'error', username: clean, reason: err.message, ms: Date.now() - t0 };
  }
}

export async function checkMany(
  usernames,
  { token = null, rps = 5, mode = 'fixed', concurrency = 1, onResult } = {}
) {
  const results = new Array(usernames.length);
  const list = [...usernames];
  let targetRps = Math.min(20, Math.max(1, Number(rps) || 5));
  let delayMs = Math.max(50, Math.round(1000 / targetRps));
  const workers = Math.min(Math.max(1, concurrency), mode === 'auto' ? 2 : 1, list.length || 1);

  let nextSlot = Date.now();
  let i = 0;
  let rateLimitHits = 0;
  const latencies = [];

  async function waitSlot() {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(nextSlot, now) + delayMs;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= list.length) return;
      await waitSlot();
      const r = await checkUsername(list[idx], token);
      results[idx] = r;
      if (typeof r.ms === 'number') {
        latencies.push(r.ms);
        if (latencies.length > 20) latencies.shift();
      }
      if (onResult) onResult(r, idx, { rps: targetRps, delayMs });

      if (mode === 'auto') {
        if (r.status === 'error' && (r.reason || '').includes('rate limited')) {
          rateLimitHits++;
          const extra = Math.max(1000, (r.retryAfter || 2) * 1000);
          targetRps = Math.max(1, targetRps * 0.5);
          delayMs = Math.max(200, Math.round(1000 / targetRps));
          nextSlot = Date.now() + extra;
        } else if (latencies.length >= 5) {
          const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
          if (avg > 1500 && targetRps > 2) {
            targetRps = Math.max(2, targetRps - 1);
            delayMs = Math.round(1000 / targetRps);
          } else if (avg < 400 && rateLimitHits === 0 && targetRps < (Number(rps) || 5)) {
            targetRps = Math.min(Number(rps) || 5, targetRps + 0.5);
            delayMs = Math.round(1000 / targetRps);
          }
        }
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
