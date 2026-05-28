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
import { resolveProjectPath } from "../resolver/project.mjs";

export const describe = "Generate the daily report as JSON or markdown.";

export async function run(args) {
  const opts = parseArgs(args);
  if (opts.help) {
    printHelp();
    return 0;
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
  });

  const format = opts.json ? "json" : "md";
  if (format === "json") {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return 0;
  }

  const useClassic = opts.classic || !data.config.humanize;
  const rendered = useClassic ? renderClassic(data) : renderHumanized(data);
  process.stdout.write(rendered);
  return 0;
}

function parseArgs(argv) {
  const out = {
    project: null,
    date: null,
    author: null,
    json: false,
    classic: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") out.project = argv[++i];
    else if (a === "--date") out.date = argv[++i];
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
      "  --author <git-name>     Override config.dev.gitUsername for git log filter",
      "  --json                  Output structured JSON (default for skills)",
      "  --md                    Output markdown (humanized or classic per config)",
      "  --classic               Force classic raw-list rendering (works with --md)",
      "  -h, --help              Show this help",
      "",
    ].join("\n")
  );
}
