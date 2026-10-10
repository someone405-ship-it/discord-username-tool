import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

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
    Referer: 'https://discord.com/register',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Ch-Ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"'
  };
  if (token) {
    h.Authorization = token;
    h.Referer = 'https://discord.com/channels/@me';
  }
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

function normalizeProxy(raw) {
  if (!raw) return null;
  let p = String(raw).trim();
  if (!p) return null;
  if (!/^https?:\/\//i.test(p) && !/^socks/i.test(p)) {
    p = 'http://' + p;
  }
  return p;
}

function agentFor(proxyUrl) {
  if (!proxyUrl) return null;
  try {
    if (proxyUrl.startsWith('https://')) return new HttpsProxyAgent(proxyUrl);
    return new HttpProxyAgent(proxyUrl);
  } catch {
    return null;
  }
}

export async function checkUsername(username, token = null, proxy = null) {
  const clean = String(username || '').trim().toLowerCase();
  if (clean.length < 2 || clean.length > 32) {
    return { status: 'invalid', username: clean, reason: 'length must be 2-32', ms: 0 };
  }
  if (!/^[a-z0-9._]+$/.test(clean) || clean.includes('..') || clean.includes('discord')) {
    return { status: 'invalid', username: clean, reason: 'invalid characters', ms: 0 };
  }

  const proxyUrl = normalizeProxy(proxy);
  const agent = agentFor(proxyUrl);
  const axiosOpts = {
    timeout: config.checkTimeoutMs || 12000,
    validateStatus: () => true,
    ...(agent ? { httpAgent: agent, httpsAgent: agent, proxy: false } : {})
  };

  const t0 = Date.now();

  if (token) {
    try {
      const res = await axios.post(POMELO_URL, { username: clean }, {
        ...axiosOpts,
        headers: baseHeaders(token)
      });
      const ms = Date.now() - t0;
      if (res.status === 429) {
        const retry = Number(res.headers?.['retry-after'] || res.data?.retry_after || 5);
        return { status: 'error', username: clean, reason: 'rate limited', retryAfter: retry, ms, raw: res.data, proxy: proxyUrl || null };
      }
      if (res.status === 200) {
        const taken = parseTaken(res.data, res.status);
        if (taken === false) return { status: 'available', username: clean, ms, method: 'pomelo', proxy: proxyUrl || null };
        if (taken === true) return { status: 'taken', username: clean, ms, method: 'pomelo', proxy: proxyUrl || null };
        if (!res.data || Object.keys(res.data).length === 0) {
          return { status: 'available', username: clean, ms, method: 'pomelo', proxy: proxyUrl || null };
        }
      }
      if (res.status === 400) {
        const taken = parseTaken(res.data, res.status);
        if (taken === true) return { status: 'taken', username: clean, ms, method: 'pomelo', proxy: proxyUrl || null };
        return { status: 'invalid', username: clean, reason: res.data?.message || 'bad request', ms, method: 'pomelo' };
      }
    } catch (err) {}
  }

  try {
    const res = await axios.post(CHECK_URL, { username: clean }, {
      ...axiosOpts,
      headers: baseHeaders(null)
    });
    const ms = Date.now() - t0;
    if (res.status === 429) {
      const retry = Number(res.headers?.['retry-after'] || res.data?.retry_after || 5);
      return { status: 'error', username: clean, reason: 'rate limited', retryAfter: retry, ms, raw: res.data, proxy: proxyUrl || null };
    }
    if (res.status === 200 && typeof res.data?.taken === 'boolean') {
      return {
        status: res.data.taken ? 'taken' : 'available',
        username: clean,
        ms,
        method: 'unauth',
        proxy: proxyUrl || null
      };
    }
    if (res.status === 400) {
      return { status: 'invalid', username: clean, reason: res.data?.message || 'bad request', ms };
    }
    return { status: 'error', username: clean, reason: res.data?.message || `http ${res.status}`, ms };
  } catch (err) {
    return { status: 'error', username: clean, reason: err.message, ms: Date.now() - t0, proxy: proxyUrl || null };
  }
}
