// Starts the wazap gateway in foreground (default) or detached mode.
// Foreground: child inherits stdio so the QR appears on the user's terminal
// and Ctrl+C stops the daemon.
// Detached: child runs in its own process group, stdout/stderr go to the log
// file under <configDir>/wazap/wazap.log, and the PID is recorded so
// `daily-report wazap stop` can find it later.

import { spawn } from "node:child_process";
import { openSync, existsSync } from "node:fs";
import { join } from "node:path";
import { wazapDir } from "../config/paths.mjs";
import {
  ensureWazapDir,
  isProcessAlive,
  logFile,
  readPid,
  readRuntime,
  writePid,
} from "./state.mjs";

export function startForeground() {
  ensureWazapDir();
  const runtime = readRuntime();
  const env = buildEnv(runtime);
  const serverPath = join(wazapDir(), "server.js");
  ensureServerInstalled(serverPath);

  const child = spawn(process.execPath, [serverPath], {
    cwd: wazapDir(),
    env,
    stdio: "inherit",
    detached: false,
  });

  // Foreground mode: forward SIGINT/SIGTERM so the child can shutdown gracefully.
  const forward = (sig) => () => {
    if (!child.killed) child.kill(sig);
  };
  process.on("SIGINT", forward("SIGINT"));
  process.on("SIGTERM", forward("SIGTERM"));

  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

export function startDetached() {
  ensureWazapDir();

  const existing = readPid();
  if (existing && isProcessAlive(existing)) {
    return { pid: existing, alreadyRunning: true };
  }

  const runtime = readRuntime();
  const env = buildEnv(runtime);
  const serverPath = join(wazapDir(), "server.js");
  ensureServerInstalled(serverPath);

  const out = openSync(logFile(), "a");
  const err = openSync(logFile(), "a");

  const child = spawn(process.execPath, [serverPath], {
    cwd: wazapDir(),
    env,
    stdio: ["ignore", out, err],
    detached: true,
  });

  if (!child.pid) {
    throw new Error("failed to spawn wazap daemon");
  }
  writePid(child.pid);
  child.unref();
  return { pid: child.pid, alreadyRunning: false };
}

function buildEnv(runtime) {
  return {
    ...process.env,
    WAZAP_PORT_INTERNAL: String(runtime.port),
    WAZAP_API_KEY: runtime.apiKey ?? "",
    WAZAP_DATA_DIR: wazapDir(),
  };
}

function ensureServerInstalled(serverPath) {
  if (!existsSync(serverPath)) {
    throw new Error(
      `Wazap server.js not found at ${serverPath}. Run \`daily-report install-wazap\` first.`
    );
  }
}
