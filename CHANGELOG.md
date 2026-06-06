# Changelog

All notable changes to `daily-report` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-06-05

Adds multi-day reports and a no-CLI path for the skill, and makes the
natural-language expectation explicit when the CLI runs in a plain terminal.

### Added

- Date ranges: `daily-report build` and `daily-report send` accept
  `--since YYYY-MM-DD` and `--until YYYY-MM-DD`. `--since` alone runs from that
  date to today; `--since`+`--until` covers the whole window. `--date` (single
  day) is unchanged. Malformed dates exit with code 65 (EX_DATAERR).
- `collect()` output gains a `period` object
  (`{ since, until, sinceBr, untilBr, isRange, label }`). For a range the report
  header switches from `*Daily ...*` to `*Report ... - <since> -> <until>*` and
  commits are grouped by type across the period.
- `src/sources/git-commits.mjs`: `listCommitsForRange()` (the single-day
  `listCommitsForDay()` now delegates to it).
- `src/resolver/dev.mjs`: `resolveRange()` and `isIsoDate()` helpers.
- Skill **skill-only mode**: `/daily-report` now works when the `daily-report`
  CLI is **not** installed. It builds the report straight from `git`, humanizes
  it, and hands the user a copy-paste-ready message to send manually (no config,
  no transport). When the CLI is present, the existing build+send flow is used.
  The skill also accepts `--since`/`--until` and natural-language periods.
- READMEs (PT+EN): "Install the skill only (no CLI)", "A single day or a date
  range", and "Natural language vs. terminal mode" sections.

### Changed

- Natural-language notice: when the CLI renders a report for a human in a
  terminal (`build --md`, `send` without `--from-stdin`), it prints a notice to
  **stderr** stating that friendly, natural-language reports are only available
  via Claude Code (or another AI agent). The agent-facing paths
  (`build --json`, `send --from-stdin`) print nothing, and the notice never
  touches stdout (pipes / `--dry-run` stay clean).

## [1.1.0] - 2026-05-29

Adds the local Wazap transport as an optional second sender. Useful for
users who do not have access to an Evolution API instance and prefer to
send dailies via their personal WhatsApp account.

### Added

- `wazap-host/` (in the published package): a small Express server wrapping
  `whatsapp-web.js` (Puppeteer + Chromium). Exposes `GET /api/status`,
  `POST /api/send/text` (X-API-Key required), `GET /api/groups`. Adapted
  from a container-only reference: all `/app/*` and `/usr/bin/chromium`
  hardcodes removed; data path is `WAZAP_DATA_DIR` (defaults to cwd).
- `src/wazap-daemon/` to start, stop, and inspect the gateway as a
  detached process or in foreground. PID file + log file live under
  `<configDir>/wazap/`. Stop sends SIGTERM, waits 10s, escalates to SIGKILL.
- `src/transports/wazap.mjs`: HTTP client. Reads port/apiKey from
  `<configDir>/wazap/wazap.json` (written by install-wazap) as source of
  truth, falls back to user config.
- `daily-report install-wazap`: copies `wazap-host/` to `<configDir>/wazap/`
  and runs `npm install` there (Puppeteer downloads Chromium ~170 MB
  inside that folder, not under daily-report's own `node_modules`).
  Generates a 24-byte hex API key, writes `wazap.json`, and syncs the user
  config.
- Linux pre-flight: install-wazap checks for `libnss3`, `libatk1.0-0`,
  `libatk-bridge2.0-0`, `libgtk-3-0`, `libasound2`, `libxshmfence1` via
  `ldconfig -p`. Missing libs cause early exit with apt/dnf instructions
  (avoids downloading 170 MB just to fail at runtime).
- `daily-report wazap start [--detach]`: foreground by default (QR code
  on terminal, Ctrl+C stops); `--detach` runs in background.
- `daily-report wazap stop [--force]`: SIGTERM with 10s grace, then SIGKILL.
- `daily-report wazap status`: PID alive + WhatsApp connection state.
- `daily-report wazap groups`: lists the connected account's groups with
  numbered indices; user picks one, and the id is saved to
  `config.wazap.groupId`.
- `daily-report wazap log`: prints the daemon's log file path.
- Config wizard: choosing transport=wazap now asks for port/url/apiKey
  /groupId instead of refusing with "not available yet".

### Changed

- `src/transports/index.mjs`: `case "wazap"` now returns the live transport
  instead of throwing.

### Fixed

- `wazap-host/server.js`: contact IDs (`5561...`) now go through
  `client.getNumberId(...)` before send, instead of a bare `<number>@c.us`.
  Recent WhatsApp builds switched to LID-based addressing and a bare
  `@c.us` triggered "No LID for user". Group JIDs are unaffected.

### Layout

```
<configDir>/wazap/
├── server.js               # copy of wazap-host/server.js
├── package.json
├── node_modules/           # includes puppeteer + its Chromium (~170 MB)
├── wazap.json              # {port, apiKey} - written by install-wazap
├── wazap.pid               # PID of detached daemon (if any)
├── wazap.log               # detached daemon stdout/stderr
└── .wwebjs_auth/           # WhatsApp session; survives package upgrades
```

The `.wwebjs_auth/` directory is what survives a `npm i -g daily-report`
upgrade and is the reason the runtime lives in `<configDir>/` instead of
under the package's own `node_modules`. See
[`docs/adr/0001-config-paths.md`](docs/adr/0001-config-paths.md).

## [1.0.0] - 2026-05-28

First release of the standalone CLI. Replaces the legacy `/daily` skill that
lived inside `previous-internal-project`.

### Added

- `daily-report` CLI (Node 20.6+, ESM, zero runtime dependencies). Subcommands:
  - `config` - interactive wizard (readline + line event so it works for both
    TTY and piped stdin); flags `--show`, `--path`, `--reset`.
  - `build` - generates the report; `--json` (default) or `--md` (`--classic`
    for the raw commit list); accepts `--project`, `--date`, `--author`.
  - `send` - end-to-end (build + render + transport); `--dry-run` previews
    without hitting the network; `--from-stdin` lets the Claude Code skill
    send an edited draft verbatim.
- Cross-platform config directory resolution
  (`src/config/paths.mjs`, [ADR 0001](docs/adr/0001-config-paths.md)):
  Linux/macOS via `$XDG_CONFIG_HOME`/`~/.config`, Windows via `%APPDATA%`,
  with `DAILY_REPORT_CONFIG_DIR` override.
- Modular report pipeline:
  - `src/core/collect.mjs` orchestrates every source.
  - `src/sources/{git-commits,github-issues,todo-pending,em-andamento,travado}.mjs`
    each focus on a single source.
  - `src/render/{markdown-classic,humanize}.mjs` for two render modes.
  - `src/resolver/{project,dev}.mjs` resolve cwd + dev profile from config.
- Evolution transport (`src/transports/evolution.mjs`) with credential
  validation, URL protocol check, and dedicated `TransportError`.
- `/daily-report` Claude Code skill in `.claude/skills/daily-report/SKILL.md`.
  Generic flow (no project-specific assumptions); invokes the `daily-report`
  binary on `PATH`.
- README in Portuguese ([README.md](README.md)) and English
  ([README.en.md](README.en.md)).
- Snapshot test (`tests/collect.test.mjs`) that builds a deterministic mini
  git repo and asserts the structured JSON shape stays stable. Run with
  `npm test`, update baseline with `npm run test:update`.

### Changed (vs the legacy `/daily` skill of `previous-internal-project v1.16.1`)

- Hardcoded `DEV_MAP` removed - every dev profile field
  (`gitUsername`/`displayName`/`tag`/`historicoDir`) comes from the user config.
- Hardcoded `workspace.code-workspace` path removed - project resolution now uses
  `git rev-parse --show-toplevel` as the natural fallback for the current
  directory, with the user's `config.projects` list for named lookups.
- Hardcoded TODO tag `@<firstName>` removed - the tag is whatever the user
  configures in `config.dev.tag`.
- Bug fix vs `previous-internal-project`: the stuck-section parser no longer uses `\Z` (which
  is literal "Z" in JavaScript regex, not an end-of-string anchor); it now walks
  the markdown line by line and reliably matches the header.

### Removed

- `scripts/daily/` (the 1:1 copy of the original skill files), preserved
  under the git tag [`pre-refactor-snapshot`](https://github.com/aldiney/daily-report/releases/tag/pre-refactor-snapshot).

[Unreleased]: https://github.com/aldiney/daily-report/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/aldiney/daily-report/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/aldiney/daily-report/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/aldiney/daily-report/releases/tag/v1.0.0
