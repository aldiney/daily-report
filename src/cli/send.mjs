// daily-report send [--project <name>] [--date YYYY-MM-DD]
//                   [--to <recipient>] [--from-stdin] [--classic] [--dry-run]
//                   [--author <git-name>]
//
// Default flow: load config, resolve project, build report, render markdown
// (humanized if config.render.humanize), send via the configured transport
// to config.<transport>.groupId.
//
// --from-stdin: skip the build and use stdin as the message body verbatim.
//               This is the path the Claude Code skill uses after it has
//               composed (and possibly edited) the report in chat.
// --dry-run:    print exactly what would be sent and skip the network call.

import { readFileSync } from "node:fs";
import { loadConfig, ConfigError } from "../config/load.mjs";
import { collect } from "../core/collect.mjs";
import { renderClassic } from "../render/markdown-classic.mjs";
import { renderHumanized } from "../render/humanize.mjs";
import { resolveProjectPath } from "../resolver/project.mjs";
import { getTransport } from "../transports/index.mjs";

export const describe =
  "Generate today's report and deliver it via the configured transport.";

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
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      return 78; // EX_CONFIG
    }
    throw err;
  }

  let message;
  if (opts.fromStdin) {
    message = readStdin();
    if (!message.trim()) {
      process.stderr.write("daily-report send --from-stdin: stdin was empty\n");
      return 65; // EX_DATAERR
    }
  } else {
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
    const useClassic = opts.classic || !data.config.humanize;
    message = useClassic ? renderClassic(data) : renderHumanized(data);
  }

  // Recipient resolution
  const recipient = opts.to || config[config.transport]?.groupId;
  if (!recipient) {
    process.stderr.write(
      `No recipient: pass --to <jid> or set config.${config.transport}.groupId.\n`
    );
    return 78;
  }

  if (opts.dryRun) {
    process.stdout.write(
      [
        `# dry-run: would send to ${recipient} via ${config.transport}`,
        "",
        message,
      ].join("\n")
    );
    return 0;
  }

  let transport;
  try {
    transport = getTransport(config);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 78;
  }

  try {
    const result = await transport.sendText({ to: recipient, text: message });
    process.stdout.write(
      `Sent to ${recipient} via ${transport.name} (HTTP ${result.httpStatus}).\n`
    );
    return 0;
  } catch (err) {
    process.stderr.write(`Send failed: ${err.message}\n`);
    return 1;
  }
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const out = {
    project: null,
    date: null,
    author: null,
    to: null,
    fromStdin: false,
    classic: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") out.project = argv[++i];
    else if (a === "--date") out.date = argv[++i];
    else if (a === "--author") out.author = argv[++i];
    else if (a === "--to") out.to = argv[++i];
    else if (a === "--from-stdin") out.fromStdin = true;
    else if (a === "--classic") out.classic = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (!out.project && !a.startsWith("--")) out.project = a;
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: daily-report send [options]",
      "",
      "Build today's report and deliver it via the configured transport.",
      "",
      "Options:",
      "  --project <name>     Use a configured project (else current working dir)",
      "  --date <YYYY-MM-DD>  Use a specific date (default: today)",
      "  --author <git-name>  Override config.dev.gitUsername for git log filter",
      "  --to <recipient>     Override config.<transport>.groupId for this send",
      "  --from-stdin         Skip build and send stdin as the message body",
      "  --classic            Use the classic raw-list rendering (else humanized)",
      "  --dry-run            Print what would be sent and exit (no network call)",
      "  -h, --help           Show this help",
      "",
      "Exit codes:",
      "  0   send successful",
      "  1   transport failure (network error, HTTP 4xx/5xx)",
      "  65  --from-stdin received empty input",
      "  66  project cannot be resolved (no matching name, missing path)",
      "  78  config missing/invalid or no recipient",
      "",
    ].join("\n")
  );
}
