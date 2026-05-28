# ADR 0001 - Config directory resolution

- **Status**: accepted
- **Date**: 2026-05-28
- **Context**: daily-report v1.0 design
- **Supersedes**: -
- **Superseded by**: -

## Problem

`daily-report` is a CLI installed globally (`npm i -g`) and is expected to work on Windows native and Linux without WSL. It needs a single, predictable location to store:

- `config.json` (user profile, transport, projects)
- the optional Wazap runtime tree (`wazap/`) and its session (`.wwebjs_auth/`)

Storing this state inside the package install (under `node_modules/daily-report/`) is wrong: any `npm i -g daily-report` upgrade would wipe the WhatsApp session and force a new QR scan.

## Decision

Resolve the config dir at runtime with this fixed priority (`src/config/paths.mjs`):

1. `process.env.DAILY_REPORT_CONFIG_DIR` - explicit override (tests, CI, sandboxes).
2. Windows: `%APPDATA%\daily-report` (fallback `%USERPROFILE%\daily-report` if `APPDATA` is empty).
3. Linux/macOS: `${XDG_CONFIG_HOME:-$HOME/.config}/daily-report`.

All path composition uses `node:path` (`join`/`resolve`). No `"path/" + name` concatenation anywhere - it breaks on Windows.

Inside this directory:

```
<configDir>/
  config.json           # user config
  wazap/                # v1.1: gateway sources + node_modules + .wwebjs_auth
    wazap.pid
    .wwebjs_auth/
```

## Consequences

- Upgrading the `daily-report` CLI does **not** delete the Wazap WhatsApp session, because it lives in the user-owned config directory, not under `node_modules`.
- Tests can run fully isolated by setting `DAILY_REPORT_CONFIG_DIR=$(mktemp -d)`.
- Containers that share `$HOME` between Linux and Windows mounts (rare) may need to set `DAILY_REPORT_CONFIG_DIR` explicitly; this is a documented edge case, not auto-detected.
- We do **not** follow XDG's `XDG_STATE_HOME` for the Wazap session even though that would be more standards-compliant. Single dir is simpler for the user to back up and reason about.

## Alternatives considered

- **`~/.daily-report/` on every OS**: simpler but pollutes the home dir on Linux/macOS, where users expect dotfiles to go under `~/.config/`.
- **Storing in `node_modules/daily-report/`**: trivial to implement but breaks on every upgrade and on multi-user systems.
- **Per-project config (`.daily-report/` next to the repo)**: rejected for v1 because the user typically wants one global identity (one git user, one WhatsApp account) shared across many projects. Can be reintroduced later as an override.
