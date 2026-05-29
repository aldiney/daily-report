# wazap-host

Local WhatsApp gateway used by `daily-report` v1.1. This is **not** a user-facing module; it gets copied into the user's config directory by `daily-report install-wazap` and runs from there.

## What it is

A small Express server wrapping `whatsapp-web.js` (Puppeteer + headless Chromium). Exposes three endpoints:

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/status` | no | reports `connected`/`qr_pending`/`disconnected` |
| `POST /api/send/text` | yes (`X-API-Key`) | body `{to, message}` — `to` is a number (`5511...`) or JID (`...@g.us` / `...@c.us`) |
| `GET /api/groups` | yes (`X-API-Key`) | array of `{id, name}` for the connected account's groups |

## Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `WAZAP_PORT_INTERNAL` | `4001` | HTTP port to listen on |
| `WAZAP_API_KEY` | `''` (open) | required value of `X-API-Key` on POST/group routes |
| `WAZAP_DATA_DIR` | `process.cwd()` | directory where `.wwebjs_auth/` (session) is stored |
| `PUPPETEER_EXECUTABLE_PATH` | unset | override the Chromium binary; default uses whatever ships with whatsapp-web.js |
| `TZ` | `America/Sao_Paulo` | timezone used in log timestamps |

## Why a separate folder

- `daily-report install-wazap` copies `wazap-host/` into `<configDir>/wazap/` and runs `npm install` there. Puppeteer downloads its own Chromium (~170 MB) into that location.
- Putting the runtime under `<configDir>` (not `node_modules/daily-report/`) means `npm i -g daily-report` upgrades **do not** delete the WhatsApp session (`.wwebjs_auth/`).
- See [docs/adr/0001-config-paths.md](../docs/adr/0001-config-paths.md) for the broader config-dir rationale.

## Local debug only

If you need to iterate on the gateway itself (not as a `daily-report` user):

```bash
cd wazap-host
npm install
WAZAP_DATA_DIR=$(pwd)/.local-data \
WAZAP_API_KEY=devkey \
node server.js
```

A QR code prints on the terminal on the first run; scan it with your WhatsApp. Subsequent starts reuse the session under `WAZAP_DATA_DIR/.wwebjs_auth/`.

For all other use cases, prefer `daily-report install-wazap` followed by `daily-report wazap start`.
