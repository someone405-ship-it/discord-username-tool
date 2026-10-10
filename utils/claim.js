import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

function buildHeaders(token) {
  return {
    Authorization: token,
    'Content-Type': 'application/json',
    'User-Agent': config.userAgent,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Super-Properties': config.xSuperProperties,
    'X-Discord-Locale': 'en-US',
    'X-Discord-Timezone': 'America/New_York',
    Referer: 'https://discord.com/channels/@me',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Not.A/Brand";v="8", "Chromium";v="131"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'X-Debug-Options': 'bugReporterEnabled'
  };
}

export async function claimUsername(username, token, password) {
  const clean = String(username || '').trim().toLowerCase();
  if (!clean || !token || !password) {
    return { success: false, message: 'username, token, and password are required' };
  }
  try {
    const res = await axios.patch(
      config.claimUrl,
      { username: clean, password: String(password) },
      {
        headers: buildHeaders(token),
        timeout: config.claimTimeoutMs || 15000,
        validateStatus: () => true
      }
    );
    if (res.status === 200) {
      return { success: true, status: res.status, data: res.data, username: clean };
    }
    const message =
      res.data?.message ||
      res.data?.errors?.username?.[0] ||
      res.data?.errors?.password?.[0] ||
      (typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 180) : `http ${res.status}`);
    return { success: false, status: res.status, message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
