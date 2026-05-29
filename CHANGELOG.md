# Changelog

All notable changes to `daily-report` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- v1.1.0 will add the local Wazap transport (`daily-report install-wazap`,
  `daily-report wazap start/stop/status/groups`).

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

[Unreleased]: https://github.com/aldiney/daily-report/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aldiney/daily-report/releases/tag/v1.0.0
