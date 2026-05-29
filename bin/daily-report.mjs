#!/usr/bin/env node
// CLI dispatcher for `daily-report`.
// Subcommands live in src/cli/*.mjs and export `{ describe, run(args) }`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, "..", "package.json");

function readPackageVersion() {
  try {
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const COMMANDS = {
  config: () => import("../src/cli/config.mjs"),
  send: () => import("../src/cli/send.mjs"),
  build: () => import("../src/cli/build.mjs"),
  "install-wazap": () => import("../src/cli/install-wazap.mjs"),
  wazap: () => import("../src/cli/wazap.mjs"),
  help: () => import("../src/cli/help.mjs"),
};

function printRootHelp() {
  const version = readPackageVersion();
  process.stdout.write(
    [
      `daily-report v${version}`,
      "",
      "Usage: daily-report <command> [options]",
      "",
      "Commands:",
      "  config           Interactive wizard to configure transport, dev profile, and project",
      "  send             Generate today's report and send it via the configured transport",
      "  build            Generate the report as JSON or markdown (does not send)",
      "  install-wazap    Install the local Wazap gateway (whatsapp-web.js + Chromium)",
      "  wazap            Manage the local Wazap daemon (start/stop/status/groups)",
      "  help             Show help for a specific command",
      "",
      "Global flags:",
      "  --version, -v    Print the package version and exit",
      "  --help, -h       Print this help and exit",
      "",
      "Run `daily-report help <command>` for command-specific options.",
      "",
    ].join("\n")
  );
}

async function main(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printRootHelp();
    return 0;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write(`${readPackageVersion()}\n`);
    return 0;
  }

  const cmd = args[0];
  const loader = COMMANDS[cmd];

  if (!loader) {
    process.stderr.write(
      `Unknown command: ${cmd}\nRun \`daily-report --help\` to see available commands.\n`
    );
    return 64; // EX_USAGE
  }

  let mod;
  try {
    mod = await loader();
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND") {
      process.stderr.write(
        `Command "${cmd}" is not implemented yet in this version.\n`
      );
      return 70; // EX_SOFTWARE
    }
    throw err;
  }

  if (typeof mod.run !== "function") {
    process.stderr.write(
      `Command "${cmd}" is malformed: missing run() export.\n`
    );
    return 70;
  }

  const exitCode = await mod.run(args.slice(1));
  return typeof exitCode === "number" ? exitCode : 0;
}

try {
  const code = await main(process.argv);
  process.exit(code);
} catch (err) {
  process.stderr.write(`daily-report: fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
}
