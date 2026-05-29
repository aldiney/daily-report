// daily-report config [--show | --path | --reset]
//
// No flag : run the interactive wizard. If a config exists already, the wizard
//           uses its values as defaults and the answers replace it on save.
// --show  : pretty-print the current config (and exit non-zero if missing)
// --path  : print the resolved config file path and exit
// --reset : run the wizard starting from defaultConfig() (no values from disk)

import { existsSync, readFileSync } from "node:fs";
import { configFile, configDir } from "../config/paths.mjs";
import { configExists, loadConfig, saveConfig } from "../config/load.mjs";
import { runWizard } from "../config/wizard.mjs";

export const describe = "Interactive wizard for the daily-report config.";

export async function run(args) {
  const opts = parseArgs(args);
  if (opts.help) {
    printHelp();
    return 0;
  }

  if (opts.path) {
    process.stdout.write(`${configFile()}\n`);
    return 0;
  }

  if (opts.show) {
    if (!configExists()) {
      process.stderr.write(`No config at ${configFile()}.\n`);
      return 78; // EX_CONFIG
    }
    process.stdout.write(readFileSync(configFile(), "utf8"));
    return 0;
  }

  const previous = opts.reset
    ? undefined
    : configExists()
    ? safeLoad()
    : undefined;

  let next;
  try {
    next = await runWizard({ previous });
  } catch (err) {
    process.stderr.write(`Wizard failed: ${err.message}\n`);
    return 70; // EX_SOFTWARE
  }

  const path = saveConfig(next);
  process.stdout.write(
    [
      "",
      `Saved config to ${path}`,
      `Run \`daily-report send\` to send today's report,`,
      `or \`daily-report build --md\` to preview it without sending.`,
      "",
    ].join("\n") + "\n"
  );
  return 0;
}

function safeLoad() {
  try {
    return loadConfig();
  } catch {
    return undefined;
  }
}

function parseArgs(argv) {
  const out = { show: false, path: false, reset: false, help: false };
  for (const a of argv) {
    if (a === "--show") out.show = true;
    else if (a === "--path") out.path = true;
    else if (a === "--reset") out.reset = true;
    else if (a === "-h" || a === "--help") out.help = true;
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: daily-report config [--show | --path | --reset]",
      "",
      "No flag    Run the interactive wizard (uses existing config as defaults).",
      "--show     Print the current config file contents.",
      "--path     Print the resolved config file path and exit.",
      "--reset    Wizard starts from schema defaults, ignoring any existing config.",
      "",
      `Config dir: ${configDir()}`,
      "Override with DAILY_REPORT_CONFIG_DIR.",
      "",
    ].join("\n")
  );
}
