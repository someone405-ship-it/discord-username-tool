import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const CHECK_URL = config.checkUrl || 'https://discord.com/api/v9/unique-username/username-attempt-unauthed';
const POMELO_URL = 'https://discord.com/api/v9/users/@me/pomelo-attempt';

function baseHeaders(token) {
  const h = {
    'Content-Type': 'application/json',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': config.userAgent,
    'X-Super-Properties': config.xSuperProperties,
    'X-Discord-Locale': 'en-US',
    Origin: 'https://discord.com',
    Referer: 'https://discord.com/channels/@me',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Ch-Ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"'
  };
  if (token) h.Authorization = token;
  return h;
}

function parseTaken(data, status) {
  if (data && typeof data.taken === 'boolean') return data.taken;
  const errs = data?.errors?.username?._errors || data?.errors?.username;
  if (Array.isArray(errs)) {
    if (errs.some((e) => String(e.code || '').includes('TAKEN') || /taken/i.test(e.message || ''))) return true;
  }
  if (status === 400 && data?.message && /taken|already/i.test(data.message)) return true;
  return null;
}

export async function checkUsername(username, token = null) {
  const clean = String(username || '').trim().toLowerCase();
  if (clean.length < 2 || clean.length > 32) {
    return { status: 'invalid', username: clean, reason: 'length must be 2-32', ms: 0 };
  }
  if (!/^[a-z0-9._]+$/.test(clean) || clean.includes('..') || clean.includes('discord')) {
    return { status: 'invalid', username: clean, reason: 'invalid characters', ms: 0 };
  }

  const t0 = Date.now();

  if (token) {
    try {
      const res = await axios.post(
        POMELO_URL,
        { username: clean },
        { headers: baseHeaders(token), timeout: config.checkTimeoutMs || 12000, validateStatus: () => true }
      );
      const ms = Date.now() - t0;
      if (res.status === 429) {
        const retry = Number(res.headers?.['retry-after'] || res.data?.retry_after || 5);
        return { status: 'error', username: clean, reason: 'rate limited', retryAfter: retry, ms, raw: res.data };
      }
      if (res.status === 200) {
        const taken = parseTaken(res.data, res.status);
        if (taken === false) return { status: 'available', username: clean, ms, raw: res.data, method: 'pomelo' };
        if (taken === true) return { status: 'taken', username: clean, ms, raw: res.data, method: 'pomelo' };
        if (!res.data || Object.keys(res.data).length === 0) {
          return { status: 'available', username: clean, ms, raw: res.data, method: 'pomelo' };
        }
      }
      if (res.status === 400) {
        const taken = parseTaken(res.data, res.status);
        if (taken === true) return { status: 'taken', username: clean, ms, raw: res.data, method: 'pomelo' };
        const msg = res.data?.message || JSON.stringify(res.data || {}).slice(0, 120);
        return { status: 'invalid', username: clean, reason: msg, ms, raw: res.data, method: 'pomelo' };
      }
    } catch (_) {}
  }

  try {
    const res = await axios.post(
      CHECK_URL,
      { username: clean },
      { headers: baseHeaders(null), timeout: config.checkTimeoutMs || 12000, validateStatus: () => true }
    );
    const ms = Date.now() - t0;
    if (res.status === 429) {
      const retry = Number(res.headers?.['retry-after'] || res.data?.retry_after || 5);
      return { status: 'error', username: clean, reason: 'rate limited', retryAfter: retry, ms, raw: res.data };
    }
    if (res.status === 200 && typeof res.data?.taken === 'boolean') {
      return res.data.taken
        ? { status: 'taken', username: clean, ms, raw: res.data, method: 'unauth' }
        : { status: 'available', username: clean, ms, raw: res.data, method: 'unauth' };
    }
    if (res.status === 400) {
      return { status: 'invalid', username: clean, reason: res.data?.message || 'bad request', ms, raw: res.data };
    }
    return {
      status: 'error',
      username: clean,
      reason: res.data?.message || `http ${res.status}`,
      ms,
      raw: res.data
    };
  } catch (err) {
    return { status: 'error', username: clean, reason: err.message, ms: Date.now() - t0 };
  }
}
