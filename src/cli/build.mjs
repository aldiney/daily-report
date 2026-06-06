// daily-report build [--json | --md] [--project <name>] [--date YYYY-MM-DD]
//                    [--author <name>] [--classic]
//
// Generates the report against the configured (or overridden) project and
// prints it. Does NOT send anything. The output format is:
//   --json    -> structured JSON (default contract for the Claude skill)
//   --md      -> markdown (humanized if config.render.humanize, else classic)
//   --classic -> force the classic raw-list rendering (works with --md only)
//
// `--project <name>` looks up the project path in config.projects. When no
// project is passed, the current working directory is used (the closest git
// repo, via `git rev-parse --show-toplevel`, falling back to cwd).

import { loadConfig, ConfigError } from "../config/load.mjs";
import { collect } from "../core/collect.mjs";
import { renderClassic } from "../render/markdown-classic.mjs";
import { renderHumanized } from "../render/humanize.mjs";
import { writeNaturalLanguageNotice } from "../render/notice.mjs";
import { resolveProjectPath } from "../resolver/project.mjs";
import { isIsoDate } from "../resolver/dev.mjs";

export const describe = "Generate the daily report as JSON or markdown.";

export async function run(args) {
  const opts = parseArgs(args);
  if (opts.help) {
    printHelp();
    return 0;
  }

  const dateError = validateDates(opts);
  if (dateError) {
    process.stderr.write(`${dateError}\n`);
    return 65; // EX_DATAERR
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError && err.code === "CONFIG_MISSING") {
      process.stderr.write(`${err.message}\n`);
      return 78; // EX_CONFIG
    }
    throw err;
  }

  let cwd;
  try {
    cwd = resolveProjectPath({ projectName: opts.project, config });
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 66; // EX_NOINPUT
  }

  const data = collect({
    config,
    cwd,
    authorOverride: opts.author,
    date: opts.date,
    since: opts.since,
    until: opts.until,
  });

  const format = opts.json ? "json" : "md";
  if (format === "json") {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return 0;
  }

  // Markdown is the human-readable render: tell the user that the truly
  // natural-language report only exists when an AI agent is in the loop.
  writeNaturalLanguageNotice();

  const useClassic = opts.classic || !data.config.humanize;
  const rendered = useClassic ? renderClassic(data) : renderHumanized(data);
  process.stdout.write(rendered);
  return 0;
}

// Returns an error string if any provided date flag is malformed, else null.
function validateDates(opts) {
  for (const [flag, value] of [
    ["--date", opts.date],
    ["--since", opts.since],
    ["--until", opts.until],
  ]) {
    if (value != null && !isIsoDate(value)) {
      return `${flag} must be in YYYY-MM-DD format (got ${JSON.stringify(value)})`;
    }
  }
  return null;
}

function parseArgs(argv) {
  const out = {
    project: null,
    date: null,
    since: null,
    until: null,
    author: null,
    json: false,
    classic: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") out.project = argv[++i];
    else if (a === "--date") out.date = argv[++i];
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--until") out.until = argv[++i];
    else if (a === "--author") out.author = argv[++i];
    else if (a === "--json") out.json = true;
    else if (a === "--md") out.json = false;
    else if (a === "--classic") out.classic = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (!out.project && !a.startsWith("--")) out.project = a;
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: daily-report build [options]",
      "",
      "Generate today's report and print it. Does not send anything.",
      "",
      "Options:",
      "  --project <name>        Use a configured project (else current working dir)",
      "  --date <YYYY-MM-DD>     Use a specific date (default: today)",
      "  --since <YYYY-MM-DD>    Start of a date range (default end: today)",
      "  --until <YYYY-MM-DD>    End of a date range (use with --since)",
      "  --author <git-name>     Override config.dev.gitUsername for git log filter",
      "  --json                  Output structured JSON (default for skills)",
      "  --md                    Output markdown (humanized or classic per config)",
      "  --classic               Force classic raw-list rendering (works with --md)",
      "  -h, --help              Show this help",
      "",
      "Natural language: the terminal render is a deterministic summary. For a",
      "friendly, natural-language daily, run the /daily-report skill in Claude.",
      "",
    ].join("\n")
  );
}
