# daily-report

> **Wrap up your dev day in 30 seconds.** A CLI that builds a summary of today's commits + your pending items and ships it to your team's WhatsApp group.

`daily-report` reads `git log` for today, groups commits by type (feat/fix/refactor/docs/...), folds in pending items from your `TODO.md` or GitHub Issues, and dispatches a formatted daily via the [Evolution API](https://doc.evolution-api.com/) or a local WhatsApp gateway (Wazap, based on [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)). Works on Linux, macOS, and Windows native - no Docker, no Python, no server of your own.

> Versao em portugues: [README.md](README.md).

## Why use it

- **One command**: `daily-report send` and the daily is in the group.
- **Nothing slips**: groups commits by type, counts everything, separates what you abandoned in `TODO_pending.md` from what you actually shipped.
- **No exotic dependencies**: Node 20.6+ and `git` on `PATH` (plus Chromium if you choose Wazap).
- **Two transports**: use Evolution if you already have the infra, or Wazap to send from your personal WhatsApp without a remote server.
- **Multi-project**: configure once, run from any folder with `--project name-of-project`.
- **Cross-platform**: Linux, macOS, and Windows native (no WSL required).
- **Pluggable into Claude Code**: the `/daily-report` skill opens the draft in chat, humanizes commits with an LLM, and lets you edit before sending.

## Installation

```bash
npm i -g github:aldiney/daily-report
daily-report --version   # 1.1.0
```

Requires **Node 20.6 or newer**. No Node? Install via [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) or [nvm-windows](https://github.com/coreybutler/nvm-windows).

If you only want **Evolution** as the transport, you're done. If you want **Wazap** (send via your personal WhatsApp), there's a second step - see [Transport 2 - Wazap](#transport-2---wazap-personal-whatsapp-local).

## First-time use (2 minutes)

1. **Configure**:
   ```bash
   daily-report config
   ```
   Interactive wizard. It asks for:
   - Your `git user.name` (auto-detected);
   - How you want to appear at the top of the daily (`displayName`);
   - Your tag in `TODO.md` (e.g. `@alice`);
   - History folder (optional, for archiving each sent daily);
   - **Transport**: `1) Evolution API` or `2) Wazap`;
   - Credentials for the chosen transport.

2. **Preview the draft**:
   ```bash
   daily-report build --md
   ```
   Prints the formatted markdown without sending. Use this to sanity-check before pushing.

3. **Send it**:
   ```bash
   daily-report send
   ```

## Commands

| Command | What it does |
|---|---|
| `daily-report config` | Interactive wizard. Re-run any time to update any field. |
| `daily-report config --show` | Print the current config (read-only). |
| `daily-report config --path` | Print the config file path. |
| `daily-report config --reset` | Wizard starting from defaults, ignoring the existing config. |
| `daily-report build --json` | Output the report as structured JSON (used by scripts and the skill). |
| `daily-report build --md` | Output the report as markdown. Add `--classic` for a raw commit list. |
| `daily-report send` | Generate + send in one step. |
| `daily-report send --dry-run` | Print exactly what would be sent, without hitting the API. |
| `daily-report send --from-stdin` | Read stdin verbatim and send (the `/daily-report` skill uses this mode). |
| `daily-report send --project X` | Run against a registered project by name (from any folder). |
| `daily-report send --date YYYY-MM-DD` | Run against another date (default: today). |
| `daily-report send --to <recipient>` | Override the configured destination for this send (a number `5511...` or a JID `...@g.us`). |
| `daily-report install-wazap` | Download and install the local Wazap gateway (~170MB Chromium). |
| `daily-report wazap start [--detach]` | Start the Wazap daemon. Foreground by default (QR scan on the terminal). |
| `daily-report wazap stop [--force]` | Stop the daemon. SIGTERM + 10s grace, then SIGKILL. |
| `daily-report wazap status` | PID alive + WhatsApp connection state. |
| `daily-report wazap groups` | List groups numerically; pick one and the JID lands in `config.wazap.groupId`. |
| `daily-report wazap log` | Print the path of the daemon's log file. |

Run `daily-report <command> --help` for every flag.

## Where the config lives

`daily-report` follows OS conventions:

- **Linux/macOS**: `~/.config/daily-report/config.json` (respects `XDG_CONFIG_HOME`).
- **Windows**: `%APPDATA%\daily-report\config.json`.
- **Override**: `DAILY_REPORT_CONFIG_DIR=/custom/path daily-report config`.

See [`docs/adr/0001-config-paths.md`](docs/adr/0001-config-paths.md) for the rationale.

## Claude Code skill

If you have [Claude Code](https://www.claude.com/product/claude-code), `daily-report` ships a `/daily-report` skill that:

1. runs `daily-report build --json`,
2. humanizes commits with an LLM (short lines, aggregating similar entries),
3. shows the preview and offers **s** (send), **e** (edit), **n** (cancel),
4. sends via `daily-report send --from-stdin` once you confirm with `s`.

The skill lives at `.claude/skills/daily-report/SKILL.md`. To use it: clone this repo and Claude Code discovers it automatically. To use it in **another** project, copy the `.claude/skills/daily-report/` folder over (the skill assumes `daily-report` is on `PATH`).

## Transports

`daily-report` v1.1 has two transports. You pick one in the wizard and can switch any time.

### Transport 1 - Evolution API (remote server)

For users who already have (or have access to) an [Evolution API](https://doc.evolution-api.com/) instance. It's the simplest path - HTTP only, no local Chromium dependency.

**What you need:**
- A running Evolution instance;
- Base URL (`https://...`), instance name, API key;
- Destination group JID (e.g. `120363xxxxx@g.us`) or a personal number (`5561...`).

**Configure:**
```bash
daily-report config
# choose "1) Evolution API" as the transport
# fill URL/instance/apiKey/groupId
```

**Switch back to Evolution** (if you're currently on Wazap):
```bash
daily-report config        # re-run, pick 1
```

### Transport 2 - Wazap (personal WhatsApp, local)

For users who **don't have** Evolution and want to send from their **own WhatsApp**. Runs a local gateway (Express + whatsapp-web.js + Puppeteer/Chromium) listening on `127.0.0.1`.

**Setup in 4 steps:**

1. **Install the local gateway** (downloads Chromium, ~170MB):
   ```bash
   daily-report install-wazap
   ```
   On Linux, the command runs a pre-flight check for Chromium libraries (`libnss3`, `libatk1.0-0`, etc). If anything is missing, it prints the exact `apt`/`dnf` command to run.

2. **Start the daemon** (foreground, prints the QR code):
   ```bash
   daily-report wazap start
   ```
   A QR code shows up on the terminal. Scan it with your WhatsApp via `Settings -> Linked devices -> Link a device`. When it connects, you'll see `Client ready`. Ctrl+C stops the daemon (session persists).

   To run in **background** after the first QR scan:
   ```bash
   daily-report wazap stop      # if it's still in foreground
   daily-report wazap start --detach
   daily-report wazap status    # confirm it's connected
   ```

3. **Pick the default group**:
   ```bash
   daily-report wazap groups
   ```
   A numbered list of all your groups. Type the number; the JID gets saved into `config.wazap.groupId`. To send to a different group just once, use `--to`.

4. **Switch the active transport to Wazap**:
   ```bash
   daily-report config        # re-run, pick 2
   ```

**The session persists**. `daily-report wazap stop` + `start` does **not** ask for a new QR. The `.wwebjs_auth/` directory lives under `<configDir>/wazap/` (not under `node_modules`), so **`npm i -g daily-report` upgrades don't wipe the session**.

**Where the gateway files live:**

```
<configDir>/wazap/
├── server.js              # the HTTP gateway
├── node_modules/          # includes puppeteer + Chromium
├── wazap.json             # {port, apiKey} generated at install time
├── wazap.pid              # PID of the detached daemon (if any)
├── wazap.log              # detached daemon stdout/stderr
└── .wwebjs_auth/          # WhatsApp session; survives upgrades
```

### Switching transports

```bash
daily-report config        # re-run the wizard, pick 1 or 2
```

Both transports live in the same `config.json` - only the `transport` field changes. You can switch as often as you want without losing credentials.

## Troubleshooting

### General

- **`daily-report: command not found`** -> reinstall with `npm i -g github:aldiney/daily-report` and confirm with `which daily-report` (`where daily-report` on Windows).
- **`No config found`** -> run `daily-report config`. Use `daily-report config --path` to see where it's looking.
- **`No recipient`** -> no `groupId` in config and no `--to` on the command line. Re-run the wizard or pass `--to 120363...@g.us`.
- **Today's commits do not show up** -> verify `config.dev.gitUsername` (must match `git config user.name`); use `daily-report send --author "Other Name"` to override on the fly.

### Evolution

- **`evolution.url must start with http:// or https://`** -> rerun `daily-report config` and fix the URL.
- **HTTP 401/404** -> wrong API key or instance name; redo the wizard.

### Wazap

- **`Linux dependencies for Chromium are missing`** during `install-wazap` -> run the `apt`/`dnf` it suggests and try again.
- **`Wazap is not installed`** when running `wazap start` -> run `daily-report install-wazap` first.
- **`No LID for user`** when sending to a personal contact -> already handled from v1.1.0 onward; if you still see it, refresh the gateway with `daily-report install-wazap --force`.
- **`WhatsApp not connected`** (HTTP 503) -> `daily-report wazap status` shows the state. If it says `qr_pending`, re-scan with `daily-report wazap start` in foreground.
- **Sending to yourself doesn't work** -> a WhatsApp Web limitation, not a package issue. Use someone else's number to test.
- **I want to tail the detached daemon log** -> `daily-report wazap log` prints the path; use `tail -f` on it.

## Project status

- **v1.1.0** (current): two transports (Evolution + local Wazap), working `/daily-report` skill, snapshot tests.
- **v1.0.0**: Evolution-only.

Versioning follows [Semantic Versioning](https://semver.org/). See [CHANGELOG.md](CHANGELOG.md).

## Origin

`daily-report` started as the internal `/daily` skill of a previous project. It was extracted into a standalone package on 2026-05-28 so any developer can use it on any project without any project-specific infrastructure. The snapshot of the code at the time of the extraction is marked by the `pre-refactor-snapshot` tag.

## License

MIT. See `LICENSE` once published.
