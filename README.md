# Discord Username Tool

Web app: **generate** short Discord usernames → **check live availability** → **optionally claim** with your own token + password.

No auto-snipe loop. You pick the name, then claim if you want.

## Features

- Generator: 2C / 2L / 2N / 3C / 3L / 3N / 4N / 4L / 4C
- Patterns: Semi 3L, Dotted, _Repeaters, Letter Repeaters, 4L/5L Pronounceable, Faces
- Wordlists: EN / FR
- Live check via Discord `username-attempt-unauthed`
- Optional claim via `PATCH /users/@me` (token + account password)
- Clean single-page UI

## Run

```bash
git clone https://github.com/someone405-ship-it/discord-username-tool.git
cd discord-username-tool
npm install
npm start
```

Open **http://localhost:3847**

## How to get your Discord token (step by step)

Only use **your own** account token. Never share it.

### Method 1 — Browser DevTools (recommended)

1. Open **https://discord.com/app** in Chrome or Edge and log in.
2. Press **F12** (or right-click → Inspect) to open DevTools.
3. Go to the **Network** tab.
4. In the filter box type: **`api`**
5. Click any channel or refresh the page so requests appear.
6. Click a request to **`/api/v9/`** or **`/api/v10/`** (for example `science` or `users/@me`).
7. In the right panel open **Headers**.
8. Scroll to **Request Headers**.
9. Find **`authorization`**.
10. Copy the full value next to it (long string, sometimes starts with `mfa.`).
11. That string is your **token**. Paste it into the Token field in the tool.

**Notes**
- Do **not** copy the word `authorization` — only the value.
- Token looks like: `mfa.ABcd...` or a long base64-looking string.
- If you log out or change password, the token can become invalid — grab a fresh one.

### Method 2 — Console (quick)

1. Open Discord in the browser, logged in.
2. Press **F12** → **Console**.
3. Paste this and press Enter:

```js
(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()
```

4. The returned string is your token. Copy it.

If that snippet fails (Discord updates often), use Method 1 instead — Network tab always works.

### Password

- The **password** field is the same password you use to log into Discord (email + password).
- Discord requires it when changing username. Forgot it → reset via Discord’s official “Forgot Password”.

## Claim flow

1. Generate or type usernames.
2. Click **Check availability**.
3. Available names stay in the box / show in the log.
4. Paste token + password.
5. Type the exact available username.
6. Click **Check + Claim**.

## API

| Method | Path | Body |
|--------|------|------|
| POST | `/api/generate` | `{ "preset": "3L", "limit": 1500 }` |
| POST | `/api/check` | `{ "usernames": ["a","b"] }` |
| POST | `/api/check-one` | `{ "username": "name" }` |
| POST | `/api/claim` | `{ "username", "token", "password" }` |

## Deploy

```bash
npm install
npm start
```

Set `PORT` if your host requires it (Railway, Render, Fly, VPS).

## Safety

- Never commit tokens or passwords.
- Never paste tokens into public chats.
- Rate limits are real — don’t spam huge batches.
