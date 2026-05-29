# daily-report

> **Wrap up your dev day in 30 seconds.** A CLI that builds a summary of today's commits + your pending items and ships it to your team's WhatsApp group.

`daily-report` reads `git log` for today, groups commits by type (feat/fix/refactor/docs/...), folds in pending items from your `TODO.md` or GitHub Issues, and dispatches a formatted daily via the Evolution API (v1.0) or a local Wazap gateway (v1.1). Works on Linux and Windows native - no Docker, no Python, no server of your own.

> Versao em portugues: [README.md](README.md).

## Why use it

- **One command**: `daily-report send` and the daily is in the group.
- **Nothing slips**: groups commits by type, counts everything, separates what you abandoned in `TODO_pending.md` from what you actually shipped.
- **No exotic dependencies**: Node 20.6+ and `git` on `PATH`.
- **Multi-project**: configure once, run from any folder with `--project name-of-project`.
- **Cross-platform**: Linux, macOS, and Windows native (no WSL required).
- **Pluggable into Claude Code**: the `/daily-report` skill opens the draft in chat and lets you edit it before sending.

## Installation

```bash
npm i -g github:aldiney/daily-report
daily-report --version
```

Requires **Node 20.6 or newer**. No Node? Install via [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) or [nvm-windows](https://github.com/coreybutler/nvm-windows).

## First-time use (2 minutes)

1. **Configure**:
   ```bash
   daily-report config
   ```
   The wizard asks for:
   - Your `git user.name` (auto-detected);
   - How you want to appear at the top of the daily (`displayName`);
   - Your tag in `TODO.md` (e.g. `@alice`);
   - History folder (optional, for archiving each sent daily);
   - Transport: **Evolution API** (v1.0) or **local Wazap** (v1.1, in development);
   - Transport credentials.

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
| `daily-report build --json` | Output the report as structured JSON (used by scripts and the skill). |
| `daily-report build --md` | Output the report as markdown. Add `--classic` for a raw commit list. |
| `daily-report send` | Generate + send in one step. |
| `daily-report send --dry-run` | Print exactly what would be sent, without hitting the API. |
| `daily-report send --from-stdin` | Read stdin verbatim and send (the `/daily-report` skill uses this mode). |
| `daily-report send --project X` | Run against a registered project by name (from any folder). |
| `daily-report send --date YYYY-MM-DD` | Run against another date (default: today). |

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
2. assembles the humanized draft in chat,
3. lets you edit (`e`) or cancel (`n`),
4. sends via `daily-report send --from-stdin` when you confirm with `s`.

The skill lives at `.claude/skills/daily-report/SKILL.md`. To use it: clone this repo and Claude Code discovers it automatically. To use it in **another** project, copy the `.claude/skills/daily-report/` folder over (the skill assumes `daily-report` is on `PATH`).

## Transports

### Evolution API (v1.0, default)

The package sends through [Evolution API](https://doc.evolution-api.com/). You need:

- A running Evolution instance (yours or a third-party);
- Base URL, instance name, API key;
- The destination group JID (e.g. `120363xxxxx@g.us`).

All captured by the wizard.

### Wazap (v1.1, in development)

For users who do **not** have Evolution and want to ship via their personal WhatsApp:

- `daily-report install-wazap` downloads the local gateway (whatsapp-web.js + Chromium via Puppeteer) into `<configDir>/wazap/`.
- `daily-report wazap start` spins up a local HTTP daemon; the first start asks for a QR scan.
- `daily-report wazap groups` lists your groups by number and you pick by number.

Wazap is not enabled in this release - the wizard offers the option but warns that it falls back to "not available yet".

## Troubleshooting

- **`daily-report: command not found`** -> reinstall with `npm i -g github:aldiney/daily-report` and confirm with `which daily-report` (`where daily-report` on Windows).
- **`No config found`** -> run `daily-report config`. Use `daily-report config --path` to see where it's looking.
- **`evolution.url must start with http:// or https://`** -> rerun `daily-report config` and fix the URL.
- **`No recipient`** -> no `groupId` in config and no `--to` on the command line. Re-run the wizard or pass `--to 120363...@g.us`.
- **HTTP 401/404 from Evolution** -> wrong API key or instance name; redo the wizard.
- **Today's commits do not show up** -> verify `config.dev.gitUsername` (must match `git config user.name`); use `daily-report send --author "Other Name"` to override on the fly.

## Project status

- **v1.0** (current): Evolution-only, stable CLI, working `/daily-report` skill.
- **v1.1** (soon): local Wazap as optional transport via `install-wazap`, numbered group picker.

## Origin

`daily-report` started as the internal `/daily` skill of a previous project. It was extracted into a standalone package on 2026-05-28 so any developer can use it on any project without any project-specific infrastructure. The snapshot of the code at the time of the extraction is marked by the `pre-refactor-snapshot` tag.

## License

MIT. See `LICENSE` once published.
