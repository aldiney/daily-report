---
name: daily-report
description: Generate and send your end-of-day dev summary to a WhatsApp group using the `daily-report` CLI. Use when the user asks for "/daily-report", "send my daily", "fecha o dia" or equivalent. Optional args - project name (e.g. "/daily-report myproject") and date (--date YYYY-MM-DD). Triggers the interactive config wizard on first run if no config exists.
argument-hint: "Optional: <project-name>, --date YYYY-MM-DD, --reconfigure"
---

# /daily-report - send your end-of-day dev summary

Thin wrapper around the `daily-report` CLI. The skill orchestrates the chat-side flow (preview, confirm, edit) and delegates everything else - config wizard, git log collection, multi-source pending list, transport - to the CLI.

## Prerequisites

1. The `daily-report` CLI must be on `PATH`. Verify with `daily-report --version`. Install with `npm i -g github:aldiney/daily-report`.
2. You are in a git repository (verify with `git rev-parse --show-toplevel`), OR you passed an explicit project name as the first argument.
3. Node 20.6 or newer (`node --version`).

If any precondition fails, say so in one sentence and stop. Do not try to "auto-fix".

## Arguments

| Form | Behavior |
|---|---|
| `/daily-report` | Today's report for the project at the current working directory. |
| `/daily-report <project-name>` | Resolve `<project-name>` against the user's configured projects list, then generate for that project. |
| `/daily-report --date YYYY-MM-DD` | Same project, different date. |
| `/daily-report --reconfigure` | Re-run the config wizard. Existing config is preserved until the wizard finishes. |

Combine flags as needed (e.g. `/daily-report myproject --date 2026-05-27`).

## Flow

### Step 1 - check config

```bash
daily-report --version >/dev/null 2>&1 || { echo "daily-report CLI not on PATH. Install with: npm i -g github:aldiney/daily-report"; exit 1; }
```

If no config exists (`daily-report send` will exit with a CONFIG_MISSING error), tell the user:

```
You have not configured daily-report yet. Run `daily-report config` in a terminal to set up:
  - Transport (Evolution API or local Wazap)
  - Your dev profile (display name, tag, history folder)
  - Project paths

Then come back and run /daily-report.
```

If the user passed `--reconfigure`, instruct them to run `daily-report config` directly - the wizard is non-interactive when driven from the skill chat, so it must be done in a real terminal.

### Step 2 - build the structured report (without sending)

```bash
daily-report build --json [--project <name>] [--date YYYY-MM-DD]
```

Capture the JSON. Expected shape:

```json
{
  "dev":     { "gitUsername", "displayName", "tag" },
  "repo":    "owner/name" | null,
  "branch":  "main" | "(detached)" | null,
  "date":    "YYYY-MM-DD",
  "dateBr":  "DD/MM/YYYY",
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

### Step 3 - humanize commits (if `config.humanize` is true)

Group `commits` by `type`. Write a short line per group:

```
- N <type>: <one-line summary of what was done, no hashes, no raw subjects>
```

Rules:
- Use `message` (subject minus the conventional-commit prefix) to understand intent.
- Aggregate similar items ("3 validation fixes" instead of "fix login, fix signup, fix reset").
- Keep each line under ~80 chars (WhatsApp line wrap).
- Keep `<type>` lowercase (`feat`, `fix`, `refactor`, `docs`, etc.).
- Preferred order: `feat` -> `fix` -> `refactor` -> `docs` -> `chore`/`test`/other.

If `config.humanize` is false: render the raw list (`- <subject> (<hash>)`).

### Step 4 - combine the pending sources

Output one section in this order: GitHub issues -> TODO file -> em-andamento.

```
*Pending / In progress*
- N open GitHub issues: #X (short title), #Y (short title)
- M items in your TODO file: <brief description>
- 1 em-andamento note: <one-line summary>
```

Rules:
- Use issue number (#15) and short title; drop labels unless they tell you something useful (`[bug]`).
- TODO entries: paraphrase, do not paste the raw `- [ ] X.Y` line.
- em-andamento: one-line summary or short bullet list - never dump the whole file.
- If a source is `null` or `[]`, **omit** that line entirely (do not show "0 issues").
- If all sources are empty, render `_(nothing)_`.

### Step 5 - render "Stuck"

If `stuck` is a string: render verbatim (the user already formatted it as markdown).
If `stuck` is `null`: render `_(nothing)_`.

### Step 6 - assemble the final report

```
*Daily {dev.displayName} - {dateBr}*
Project: {repo} - branch: {branch}

*Done today*
{humanized or raw commit list}

*Pending / In progress*
{combined sources block}

*Stuck*
{text or _(nothing)_}

Total commits: {commitsTotal}
```

Rules for the "Project" line:
- Always immediately after the header, before "Done today".
- If `repo` is `null` (no remote), omit the line entirely.
- If `branch` is `null`, render only `Project: {repo}` (no `- branch: ...`).
- Exact format: `Project: owner/name - branch: main` (regular hyphen, spaces around it).

### Step 7 - preview + confirm

```
Draft of /daily-report for {repo or project name} ({dateBr}):

{final report}

Send to the configured group?
  s - send as-is
  e - edit before sending
  n - cancel
```

Wait for the answer.

### Step 8a - "s" - send

```bash
printf '%s\n' "<final report>" | daily-report send --from-stdin
```

Report exit code + transport response. On failure, show stderr and ask whether to retry. **Do not archive on failure.**

### Step 8b - "e" - edit

Ask: "Paste the edited text below (one message):". Capture, re-render the preview, loop until `s` or `n`.

### Step 8c - "n" - cancel

Confirm: `Cancelled. Nothing was sent.` and stop.

### Step 9 - archive (only after a successful send)

If `config.dev.historicoDir` is set in the user's config, save the sent report to:

```
<projectPath>/<historicoDir>/<YYYY-MM-DD>-daily.md
```

(with a `-<projectName>` suffix when an explicit project arg was used).

Content:

```markdown
# Daily {dev.displayName} - {dateBr} ({projectName})

{final report verbatim}

---

_Sent via /daily-report at {YYYY-MM-DD HH:mm}._
```

Overwrite if the file already exists (last send wins). Report: `Daily archived at <relative path>.`

If `historicoDir` is empty or the directory does not exist: warn `No history folder configured - daily was sent but not archived.` and do **not** create the directory automatically.

## Edge cases

- **Empty everything** (no commits, no TODOs, no issues, no em-andamento, no stuck): render the minimal report with `_(nothing committed)_` and `_(nothing)_`. Still preview + confirm.
- **`daily-report` not on PATH**: stop immediately with the install instruction. Do not try to call `npx`.
- **Config missing**: stop and instruct the user to run `daily-report config` in a real terminal.
- **`--reconfigure`**: do not run the wizard from inside the chat. Tell the user to run `daily-report config` in a terminal.
- **Build returns no commits but flags an error**: surface the error verbatim; do not silently skip.

## Never do

- Never call the transport directly. Always go through `daily-report send`.
- Never try to "improve" the draft automatically. Editing is the user's job.
- Never send to a destination other than the one in the user's config.
- Never archive on a failed send.
- Never commit anything automatically. Archive only writes the file to the working tree.
- Never assume the user knows what JID, API key, or QR pairing means - on failure, point them at the CLI help (`daily-report help send`) or the README.

## References

- CLI binary: `daily-report` (on PATH, installed via `npm i -g github:aldiney/daily-report`).
- Config wizard: `daily-report config`.
- Build command: `daily-report build --json`.
- Send command: `daily-report send` and `daily-report send --from-stdin`.
- Top-level README: `README.md` (PT) and `README.en.md` (EN).
