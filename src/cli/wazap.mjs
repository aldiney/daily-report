// daily-report wazap <subcommand>
//
//   start [--detach]   foreground (default; QR on terminal, Ctrl+C stops)
//                      or background (writes PID, logs to wazap.log)
//   stop  [--force]    SIGTERM then SIGKILL on timeout (--force = SIGKILL right away)
//   status             "running"/"not running" + WhatsApp connection state
//   groups             list the groups of the connected account, interactively
//                      pick one by number, and store its id in user config

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { loadConfig, saveConfig } from "../config/load.mjs";
import { runtimeFile, readRuntime } from "../wazap-daemon/state.mjs";
import { startForeground, startDetached } from "../wazap-daemon/start.mjs";
import { stopDaemon } from "../wazap-daemon/stop.mjs";
import { getStatus } from "../wazap-daemon/status.mjs";
import { create as createWazapTransport } from "../transports/wazap.mjs";
import { wazapDir } from "../config/paths.mjs";

export const describe =
  "Manage the local Wazap daemon (start/stop/status/groups).";

export async function run(args) {
  const [sub, ...rest] = args;
  if (!sub || sub === "-h" || sub === "--help") {
    printHelp();
    return 0;
  }

  switch (sub) {
    case "start":  return await cmdStart(rest);
    case "stop":   return await cmdStop(rest);
    case "status": return await cmdStatus(rest);
    case "groups": return await cmdGroups(rest);
    case "log":    return cmdLog();
    default:
      process.stderr.write(`Unknown wazap subcommand: ${sub}\n`);
      printHelp();
      return 64; // EX_USAGE
  }
}

// ===== start =====

async function cmdStart(args) {
  const detach = args.includes("--detach") || args.includes("-d");
  try {
    if (detach) {
      const { pid, alreadyRunning } = startDetached();
      if (alreadyRunning) {
        process.stdout.write(`Wazap already running (PID ${pid}).\n`);
      } else {
        process.stdout.write(`Wazap daemon started in background (PID ${pid}).\n`);
        process.stdout.write(`Logs: ${wazapDir()}/wazap.log\n`);
        process.stdout.write(`Run \`daily-report wazap status\` to check connection.\n`);
      }
      return 0;
    }
    const code = await startForeground();
    return typeof code === "number" ? code : 0;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }
}

// ===== stop =====

async function cmdStop(args) {
  const force = args.includes("--force") || args.includes("-f");
  try {
    const result = await stopDaemon({ force });
    if (result.stopped) {
      process.stdout.write(
        `Wazap stopped (PID ${result.pid}${result.escalated ? "; escalated to SIGKILL" : ""}).\n`
      );
      return 0;
    }
    process.stdout.write(`Nothing to stop: ${result.reason}.\n`);
    return result.pid ? 1 : 0;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }
}

// ===== status =====

async function cmdStatus() {
  const s = await getStatus();
  if (!s.running) {
    process.stdout.write(`Wazap not running (${s.reason}).\n`);
    return 1;
  }
  if (!s.http) {
    process.stdout.write(`Wazap process alive (PID ${s.pid}) but HTTP not responding: ${s.reason}\n`);
    return 2;
  }
  const body = s.http.body;
  if (!body) {
    process.stdout.write(`Wazap running (PID ${s.pid}); HTTP ${s.http.status} with no JSON body.\n`);
    return 0;
  }
  process.stdout.write(
    [
      `Wazap running (PID ${s.pid})`,
      `WhatsApp: ${body.status}${body.port ? " on port " + body.port : ""}`,
    ].join("\n") + "\n"
  );
  return 0;
}

// ===== groups =====

async function cmdGroups() {
  let runtime;
  try {
    runtime = readRuntime();
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }

  const transport = createWazapTransport({
    url: `http://127.0.0.1:${runtime.port}`,
    apiKey: runtime.apiKey,
  });

  let groups;
  try {
    groups = await transport.listGroups();
  } catch (err) {
    process.stderr.write(
      [
        `Could not list groups: ${err.message}`,
        `Is the daemon running and the WhatsApp connected? Try \`daily-report wazap status\`.`,
      ].join("\n") + "\n"
    );
    return 1;
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    process.stdout.write("No groups found for this account.\n");
    return 0;
  }

  const padding = String(groups.length).length;
  process.stdout.write(`\nGroups (${groups.length}):\n`);
  groups.forEach((g, i) => {
    process.stdout.write(`  ${String(i + 1).padStart(padding)}) ${g.name} (${g.id})\n`);
  });
  process.stdout.write("\n");

  const choice = await prompt(`Pick a group by number (or blank to skip): `);
  if (!choice.trim()) {
    process.stdout.write("No selection made; nothing was saved.\n");
    return 0;
  }
  const n = Number(choice.trim());
  if (!Number.isInteger(n) || n < 1 || n > groups.length) {
    process.stderr.write(`Invalid choice: ${choice.trim()}\n`);
    return 1;
  }

  const selected = groups[n - 1];
  try {
    const cfg = loadConfig();
    cfg.wazap = cfg.wazap || {};
    cfg.wazap.groupId = selected.id;
    cfg.wazap.url = `http://127.0.0.1:${runtime.port}`;
    cfg.wazap.apiKey = runtime.apiKey;
    saveConfig(cfg);
    process.stdout.write(`Saved wazap.groupId = ${selected.id} (${selected.name}).\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`Could not save config: ${err.message}\n`);
    process.stdout.write(`Selection was: ${selected.id} (${selected.name}).\n`);
    return 1;
  }
}

// ===== log =====

function cmdLog() {
  process.stdout.write(
    [
      `Wazap log file: ${wazapDir()}/wazap.log`,
      "Tail it with:  tail -f \"$(daily-report config --path | xargs dirname)/wazap/wazap.log\"",
      "(or on Windows, use Get-Content -Wait)",
    ].join("\n") + "\n"
  );
  return 0;
}

// ===== help / prompt =====

function printHelp() {
  process.stdout.write(
    [
      "Usage: daily-report wazap <subcommand> [options]",
      "",
      "Subcommands:",
      "  start [--detach]    Foreground (default; QR on terminal, Ctrl+C stops)",
      "                      or background mode (writes PID, logs to wazap.log).",
      "  stop  [--force]     SIGTERM then SIGKILL on timeout.",
      "                      --force sends SIGKILL right away.",
      "  status              Show daemon PID + WhatsApp connection state.",
      "  groups              List the connected account's groups and pick one",
      "                      by number; selected id is saved to config.wazap.groupId.",
      "  log                 Print the path of the daemon's log file.",
      "",
      `Runtime config: ${runtimeFile()}`,
      "",
    ].join("\n")
  );
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: false });
    stdout.write(question);
    rl.once("line", (line) => {
      rl.close();
      resolve(line);
    });
  });
}
