---
name: daily-report
description: Generate your end-of-day (or multi-day) dev summary in natural language. Works in two modes - if the `daily-report` CLI is installed it builds and sends via the configured WhatsApp transport; if only the skill is installed it builds the report from git and hands you a copy-paste-ready message to send manually. Use when the user asks for "/daily-report", "send my daily", "fecha o dia", "resumo da semana" or equivalent. Optional args - project name, single date (--date YYYY-MM-DD) or range (--since/--until).
argument-hint: "Optional: <project-name>, --date YYYY-MM-DD, --since/--until YYYY-MM-DD, --reconfigure"
---

# /daily-report - your end-of-day dev summary, in natural language

Builds a dev summary from `git log` and renders it as a friendly,
natural-language report. Because you (an AI agent) are in the loop, the report
is always written in natural language - never a raw commit dump.

The skill runs in one of **two modes**, decided in Step 1:

- **CLI mode** - the `daily-report` CLI is on `PATH`. The skill builds the
  structured report via the CLI, humanizes it, previews it, and **sends** it
  through the user's configured transport (Evolution or local Wazap).
- **Skill-only mode** - the CLI is **not** installed. The skill gathers the
  data straight from `git`, humanizes it, and hands the user a **copy-paste
  ready** message to send manually. No config, no transport, nothing to install
  beyond this skill folder.

## Arguments

| Form | Behavior |
|---|---|
| `/daily-report` | Today's report for the project at the current working directory. |
| `/daily-report <project-name>` | Resolve `<project-name>` (CLI mode: against the configured projects list; skill-only mode: treat as a path or the current repo). |
| `/daily-report --date YYYY-MM-DD` | A single specific day. |
| `/daily-report --since YYYY-MM-DD [--until YYYY-MM-DD]` | A **date range**. If `--until` is omitted, the range ends today. |
| `/daily-report --reconfigure` | (CLI mode only) Re-run the config wizard. |

Natural-language periods also work - "esta semana", "últimos 7 dias", "last
3 days". Convert them to concrete ISO dates yourself (today is known from the
environment) and pass `--since`/`--until`. Combine flags freely
(e.g. `/daily-report myproject --since 2026-06-01 --until 2026-06-05`).

## Step 1 - detect the mode

```bash
daily-report --version >/dev/null 2>&1 && echo CLI_MODE || echo SKILLONLY_MODE
```

- `CLI_MODE` -> follow **Flow A**.
- `SKILLONLY_MODE` -> follow **Flow B**. Do **not** tell the user to install
  anything; skill-only mode is a fully supported path.

In both modes, confirm you are in a git repository (or that an explicit project
path was given) before continuing:

```bash
git rev-parse --show-toplevel
```

If that fails and no explicit project path was provided, say so in one sentence
and stop.

---

## Flow A - CLI mode (build + send)

### A1 - build the structured report

```bash
daily-report build --json [--project <name>] [--date YYYY-MM-DD] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

`build --json` is the machine contract - it prints **only** JSON to stdout (no
natural-language notice). Capture it. Expected shape:

```json
{
  "dev":     { "gitUsername", "displayName", "tag" },
  "repo":    "owner/name" | null,
  "branch":  "main" | "(detached)" | null,
  "date":    "YYYY-MM-DD",
  "dateBr":  "DD/MM/YYYY",
  "period":  { "since", "until", "sinceBr", "untilBr", "isRange", "label" },
  "commits": [{ "hash", "subject", "type", "scope", "message" }],
  "commitsTotal": N,
  "pending": {
    "githubIssues": [{ "number", "title", "labels" }] | null,
    "todoFile":     ["raw line", ...] | null,
    "emAndamento":  "text" | null
  },
  "stuck": "text" | null,
  "config": { "humanize": true|false }
}
```

If `build` exits with a CONFIG_MISSING error, tell the user:

```
You have not configured daily-report yet. Run `daily-report config` in a
terminal to set up transport + dev profile + projects, then re-run /daily-report.
```

If the user passed `--reconfigure`, instruct them to run `daily-report config`
directly (the wizard needs a real terminal; it cannot be driven from chat).

### A2 - humanize + assemble (see "Writing the report" below), then preview

```
Draft of /daily-report for {repo or project} ({period.label}):

{final report}

Send to the configured group?
  s - send as-is
  e - edit before sending
  n - cancel
```

### A3 - act on the answer

- **s** -> send verbatim:
  ```bash
  printf '%s\n' "<final report>" | daily-report send --from-stdin
  ```
  `send --from-stdin` sends the text as-is (no notice, no re-render). Report the
  exit code + transport response. On failure show stderr and ask whether to
  retry. **Do not archive on failure.**
- **e** -> "Paste the edited text below (one message):", capture, re-preview,
  loop until `s` or `n`.
- **n** -> `Cancelled. Nothing was sent.` and stop.

### A4 - archive (only after a successful send)

If `config.dev.historicoDir` is set, save the sent report to
`<projectPath>/<historicoDir>/<period>-daily.md` (use `date` for a single day,
or `<since>_<until>` for a range; add a `-<projectName>` suffix when an explicit
project arg was used):

```markdown
# Daily {dev.displayName} - {period.label} ({projectName})

{final report verbatim}

---

_Sent via /daily-report at {YYYY-MM-DD HH:mm}._
```

Overwrite if it exists. Report `Daily archived at <relative path>.` If
`historicoDir` is empty or missing, warn `No history folder configured - daily
was sent but not archived.` and do **not** create the directory.

---

## Flow B - skill-only mode (build from git + manual copy)

No CLI, no config, no transport. You gather the data, humanize it, and give the
user a ready-to-paste message. **Never** try to send it - the user sends it
manually (WhatsApp, Slack, email, wherever).

### B1 - gather the facts from git

Resolve the date window first (single day = today by default; or the `--date`,
or the `--since`/`--until` range the user asked for). Then:

```bash
NAME="$(git config user.name)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE="$(git remote get-url origin 2>/dev/null)"   # may be empty; parse owner/name from it
# Commits in the window (single day: same date for both bounds):
git log --author="$NAME" --since="<START> 00:00" --until="<END> 23:59" --pretty=format:'%h%x09%s'
```

Each commit line is `shorthash<TAB>subject`. Categorize each subject by its
conventional-commit prefix (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`,
`perf`, `build`, `ci`, `style`, `revert`; everything else is `other`).

If the user gave an explicit author or you suspect `git config user.name`
differs from the commit author, ask or pass the right name to `--author`.

### B2 - gather pending items (best-effort, optional)

Skill-only mode has no config, so do a light, best-effort pass and silently skip
anything absent:

- TODO file: if `TODO_pending.md` or `TODO.md` exists in the repo root, read the
  open `- [ ]` lines (filter to the user's tag if they mention one).
- GitHub issues: if `gh` is on PATH, `gh issue list --assignee @me --limit 10`.

Never block on these; if none are present, the pending section is `_(nothing)_`.

### B3 - write the report (see "Writing the report" below), then present it

Show it inside a fenced code block so it is trivial to copy, and tell the user
to send it manually:

```
Here is your daily for {repo or folder} ({period.label}). Copy and send it
manually to your group:

\```
{final report}
\```

Want me to tweak anything before you copy it? (or say "save" to write it to a file)
```

If the user asks to edit, apply the change and re-show the block. If they ask to
"save", write it to `<repo>/<period>-daily.md` in the working tree (never
commit). There is no automatic archive in skill-only mode.

---

## Writing the report (both modes)

Always natural language. The goal is a human-readable summary a teammate can
skim in 5 seconds - not a commit log.

### Humanize the commits

Group by `type`. Write one short line per group describing **what was done**,
not the raw subjects:

```
- N <type>: <one-line natural summary, no hashes, no raw subjects>
```

Rules:
- Use `message` (subject minus the conventional-commit prefix) to understand intent.
- Aggregate similar items ("3 validation fixes" beats "fix login, fix signup, fix reset").
- Keep each line under ~80 chars (WhatsApp wraps).
- `<type>` stays lowercase. Preferred order: `feat` -> `fix` -> `refactor` -> `docs` -> `chore`/`test`/other.
- For a **range** with many commits, summarize per type across the whole window
  ("12 commits over 3 days: shipped X, fixed Y, refactored Z") - do not paste
  every commit.

### Combine the pending sources

One section, in this order: GitHub issues -> TODO file -> em-andamento. Omit any
empty source entirely (never "0 issues"). If all empty: `_(nothing)_`.
Paraphrase TODO and em-andamento lines; never dump the raw file.

### "Stuck"

If present, render verbatim (the user already formatted it). If absent: `_(nothing)_`.

### Assemble

Header is `*Daily ...*` for a single day and `*Report ...*` for a range:

```
*Daily {dev.displayName} - {period.label}*          (single day)
*Report {dev.displayName} - {period.label}*         (range)
Project: {repo} - branch: {branch}

*Done today*                                         (single day)
*Done in this period*                                (range)
{humanized commits}

*Pending / In progress*
{combined sources}

*Stuck*
{text or _(nothing)_}

Total commits: {commitsTotal}
```

Project line rules: immediately after the header; omit entirely if `repo` is
null; render only `Project: {repo}` when `branch` is null; exact format
`Project: owner/name - branch: main` (regular hyphen, spaces around it).

## Edge cases

- **Empty everything** (no commits/TODOs/issues/em-andamento/stuck): render the
  minimal report with `_(nothing committed)_` and `_(nothing)_`. Still preview
  (Flow A) or present (Flow B).
- **CLI mode, config missing**: stop and point at `daily-report config`.
- **`--reconfigure`**: Flow A only; tell the user to run `daily-report config`
  in a terminal. Not applicable in skill-only mode.
- **Range with zero commits**: say so plainly ("no commits authored by X between
  ... and ..."); do not invent activity.
- **Build returns an error**: surface it verbatim; do not silently skip.

## Never do

- Never send anything in skill-only mode - the user sends manually.
- Never call a transport directly in CLI mode - always go through `daily-report send`.
- Never "improve" the draft on your own beyond humanizing - editing is the user's job.
- Never send to a destination other than the one in the user's config (CLI mode).
- Never archive on a failed send; never commit anything automatically.
- Never produce a raw commit dump - the whole point of the skill is natural language.

## References

- CLI binary (CLI mode): `daily-report` on PATH (`npm i -g github:aldiney/daily-report`).
- Config wizard: `daily-report config`. Build: `daily-report build --json`.
- Send: `daily-report send --from-stdin`.
- Top-level README: `README.md` (PT) and `README.en.md` (EN), incl. "Install the
  skill only (no CLI)".
