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
- **One day or a range**: a single day (`--date`) or a whole period (`--since`/`--until`) - handy for wrapping up the week.
- **Cross-platform**: Linux, macOS, and Windows native (no WSL required).
- **Pluggable into Claude Code**: the `/daily-report` skill opens the draft in chat, humanizes commits with an LLM, and lets you edit before sending.
- **Skill-only, no CLI**: you can install **just the skill** - it builds the report in natural language and hands it to you ready to copy and send by hand. See [Install the skill only](#install-the-skill-only-no-cli).

## Installation

Requires **Node 20.6+** and `git` on `PATH`. If you don't have Node yet, install it via [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) or [nvm-windows](https://github.com/coreybutler/nvm-windows).

### Step 1 - per-user npm prefix (Linux/macOS, no sudo)

On many Node installations from apt/brew, `npm -g` wants to write to `/usr` or `/usr/local` and demands `sudo`. To avoid that, configure a per-user prefix **once**:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> On **Windows**, `npm -g` already writes to `%APPDATA%\npm` by default - no sudo, no tweaking. **Skip this step.**
>
> If you installed Node via **nvm** (Linux/macOS/Windows), the prefix is already per-user. **Skip this step.**
>
> Prefer `sudo`? Fine - just prefix each command in step 2 with `sudo npm ...`.

### Step 2 - install the CLI

Pick one:

**Option A - published version (simplest):**
```bash
npm i -g github:aldiney/daily-report
```

**Option B - local development (any code change shows up immediately):**
```bash
git clone https://github.com/aldiney/daily-report.git
cd daily-report
npm link
```

### Step 3 - verify

```bash
daily-report --version   # 1.2.0
which daily-report       # path to the binary
```

If `daily-report: command not found`, open a new terminal (so `~/.bashrc` is re-read) or run `source ~/.bashrc`.

If you only want **Evolution** as the transport, you're done. If you want **Wazap** (send via your personal WhatsApp), there's a fourth step - see [Transport 2 - Wazap](#transport-2---wazap-personal-whatsapp-local).

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
| `daily-report send --date YYYY-MM-DD` | Run against a single specific day (default: today). |
| `daily-report send --since YYYY-MM-DD [--until YYYY-MM-DD]` | Run against a **date range**. Without `--until`, it ends today. Works on `build` too. |
| `daily-report send --to <recipient>` | Override the configured destination for this send (a number `5511...` or a JID `...@g.us`). |
| `daily-report install-wazap` | Download and install the local Wazap gateway (~170MB Chromium). |
| `daily-report wazap start [--detach]` | Start the Wazap daemon. Foreground by default (QR scan on the terminal). |
| `daily-report wazap stop [--force]` | Stop the daemon. SIGTERM + 10s grace, then SIGKILL. |
| `daily-report wazap status` | PID alive + WhatsApp connection state. |
| `daily-report wazap groups` | List groups numerically; pick one and the JID lands in `config.wazap.groupId`. |
| `daily-report wazap log` | Print the path of the daemon's log file. |

Run `daily-report <command> --help` for every flag.

## A single day or a date range

By default the report covers **today**. For a specific day use `--date`; for a
**whole period** use `--since` (and optionally `--until`):

```bash
daily-report build --md --date 2026-06-04            # just June 4th
daily-report build --md --since 2026-06-01           # from June 1st to today
daily-report send    --since 2026-06-01 --until 2026-06-05   # the whole week
```

For a range, the header becomes `*Report Name - 01/06/2026 -> 05/06/2026*` and
commits are aggregated by type across the whole period. The flags work on both
`build` and `send`.

## Natural language vs. terminal mode

`daily-report` always aims to deliver the report in **natural language**. The
truly human, friendly writing (short sentences, similar items folded into prose)
happens when an **AI agent** is in the loop - the `/daily-report` skill running
in [Claude Code](https://www.claude.com/product/claude-code) (or another agent)
rewrites the commits before sending.

Running the CLI **straight in a terminal** (no agent) can't produce real prose:
what you get is a **deterministic summary** (grouped by type). Because of that,
`build --md` and `send` print a notice to `stderr` reminding you that the
natural-language report is only available through Claude or another AI agent. The
notice goes to `stderr`, so it **never pollutes** the report on `stdout` (pipes
and `--dry-run` stay clean). The agent-facing paths - `build --json` and
`send --from-stdin` - print no notice.

## Where the config lives

`daily-report` follows OS conventions:

- **Linux/macOS**: `~/.config/daily-report/config.json` (respects `XDG_CONFIG_HOME`).
- **Windows**: `%APPDATA%\daily-report\config.json`.
- **Override**: `DAILY_REPORT_CONFIG_DIR=/custom/path daily-report config`.

See [`docs/adr/0001-config-paths.md`](docs/adr/0001-config-paths.md) for the rationale.

## Claude Code skill

If you have [Claude Code](https://www.claude.com/product/claude-code), `daily-report` ships a `/daily-report` skill that runs in **two modes**, decided automatically:

- **CLI mode** (the `daily-report` CLI is on `PATH`): the skill runs `daily-report build --json`, humanizes commits with an LLM, shows a preview with **s** (send), **e** (edit), **n** (cancel), and **sends** via `daily-report send --from-stdin` once you confirm with `s`.
- **Skill-only mode** (the CLI is **not** installed): the skill gathers the data straight from `git`, humanizes it, and hands you a **copy-paste-ready** message - you send it by hand. No CLI, no config, no transport.

The skill accepts the same arguments as the CLI: a project name, `--date`, and the `--since`/`--until` range (or natural language like "this week's summary", "last 7 days").

### Install the skill only (no CLI)

If you **don't want to install the CLI** and just want Claude (or another agent) to generate the report in natural language for you to **copy and send manually**:

1. Copy the skill folder into your project (or into Claude Code's global skills directory):
   ```bash
   # inside the project where you'll use it:
   mkdir -p .claude/skills
   cp -r /path/to/daily-report/.claude/skills/daily-report .claude/skills/
   ```
   Alternative: download just the `SKILL.md` from this repo (`.claude/skills/daily-report/SKILL.md`) into `.claude/skills/daily-report/SKILL.md`.

2. Open Claude Code in the project and run:
   ```
   /daily-report
   /daily-report --since 2026-06-01 --until 2026-06-05
   ```

3. The skill builds the report from `git log` and shows it in a copy-friendly block. **Copy and paste** it into your WhatsApp group (or anywhere) and send. Nothing is sent automatically in this mode.

Skill-only prerequisites: be inside a git repository with `git` on `PATH`. That's it - no `npm install`, no transport to configure.

> Want automatic WhatsApp sending later? Just install the CLI (steps above) - the same skill switches to **CLI mode** on its own.

### Using the skill in another project (CLI mode)

Clone this repo and Claude Code discovers the skill automatically. To use it in **another** project with the CLI installed, copy the `.claude/skills/daily-report/` folder over (the skill assumes `daily-report` is on `PATH`).

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

- **`daily-report: command not found`** -> first thing, open a new terminal (the `~/.bashrc` entry needs to be re-read). If it persists, confirm `~/.npm-global/bin` is on `PATH` (see [Installation Step 1](#step-1---per-user-npm-prefix-linuxmacos-no-sudo)) and that `npm prefix -g` points to `~/.npm-global`. As a last resort, reinstall with `npm i -g github:aldiney/daily-report`.
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

- **v1.2.0** (current): date ranges (`--since`/`--until`), `/daily-report` skill in two modes (CLI + skill-only copy/send-by-hand), natural-language notice in terminal mode.
- **v1.1.0**: two transports (Evolution + local Wazap), working `/daily-report` skill, snapshot tests.
- **v1.0.0**: Evolution-only.

Versioning follows [Semantic Versioning](https://semver.org/). See [CHANGELOG.md](CHANGELOG.md).

## Origin

`daily-report` started as the internal `/daily` skill of a previous project. It was extracted into a standalone package on 2026-05-28 so any developer can use it on any project without any project-specific infrastructure. The snapshot of the code at the time of the extraction is marked by the `pre-refactor-snapshot` tag.

## License

MIT. See `LICENSE` once published.
