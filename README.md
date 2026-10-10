# Discord Username Tool

Web app: **generate** short Discord usernames → **check live availability** → **optionally claim** with your token + password.

No auto-snipe loop. Checks first — if the name is taken, it does **not** claim.

## Features

- Generator: 2C / 2L / 2N / 3C / 3L / 3N / 4N / 4L / 4C
- Patterns: Semi 3L, Dotted, _Repeaters, Letter Repeaters, 4L/5L Pronounceable, Faces
- Wordlists: EN / FR
- Live check via Discord API
- Optional claim (token + password)
- **Render env support:** `DISCORD_TOKEN` + `DISCORD_PASSWORD`

## Run locally

```bash
git clone https://github.com/someone405-ship-it/discord-username-tool.git
cd discord-username-tool
npm install
npm start
```

Open **http://localhost:3847**

## Deploy on Render

1. [render.com](https://render.com) → **New** → **Web Service**
2. Connect repo: `someone405-ship-it/discord-username-tool`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Open **Environment** and add:

| Key | Value |
|-----|--------|
| `DISCORD_TOKEN` | your Discord user token |
| `DISCORD_PASSWORD` | your Discord account password |

6. Deploy → open the Render URL

With env vars set, you can leave the token/password boxes empty in the UI. You can still override them by pasting in the form.

**Never** put the token in the GitHub repo — only in Render Environment.

## Claim safety

1. Tool checks the name live on Discord.
2. If status is not `available` → **stops**, does not claim.
3. Only if available → sends the claim with token + password.

## How to get your Discord token

### Browser (PC)

1. Open https://discord.com/app and log in  
2. F12 → **Network** → filter `api`  
3. Click a request like `users/@me`  
4. **Headers** → **Request Headers** → **authorization** → copy the value  

### Mobile (Kiwi Browser)

Three dots → Developer tools → Network → filter `api` → open a request → Headers → authorization → copy value  

Password = the same password you use to log into Discord.

## API

| Method | Path | Body |
|--------|------|------|
| GET | `/api/status` | — shows if env token/password are set |
| POST | `/api/generate` | `{ "preset": "3L", "limit": 1500 }` |
| POST | `/api/check` | `{ "usernames": ["a","b"] }` |
| POST | `/api/check-one` | `{ "username": "name" }` |
| POST | `/api/claim` | `{ "username", "token?", "password?" }` |

Token/password in the body override env. If omitted, env is used.
