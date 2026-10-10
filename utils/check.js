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
    return { status: 'invalid', username: clean, reason: 'length must be 2-32' };
  }
  if (/[@#:`]/.test(clean) || clean.includes('discord')) {
    return { status: 'invalid', username: clean, reason: 'forbidden characters or substring' };
  }
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
    if (res.status === 200 && res.data && typeof res.data.taken === 'boolean') {
      return res.data.taken === false
        ? { status: 'available', username: clean, raw: res.data }
        : { status: 'taken', username: clean, raw: res.data };
    }
    const msg =
      res.data?.message ||
      res.data?.errors?.username?.[0] ||
      (typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 160) : String(res.data || ''));
    if (res.status === 429) {
      return { status: 'error', username: clean, reason: 'rate limited — wait a bit', raw: res.data };
    }
    if (res.status === 400) {
      return { status: 'invalid', username: clean, reason: msg || 'bad request', raw: res.data };
    }
    return { status: 'error', username: clean, reason: msg || `http ${res.status}`, raw: res.data };
  } catch (err) {
    return { status: 'error', username: clean, reason: err.message };
  }
}

export async function checkMany(usernames, { token = null, concurrency = 3, delayMs = 120, onResult } = {}) {
  const results = [];
  const list = [...usernames];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      const r = await checkUsername(list[idx], token);
      results[idx] = r;
      if (onResult) onResult(r, idx);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  const n = Math.min(Math.max(1, concurrency), list.length || 1);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
