// State helpers shared by every wazap-daemon operation:
// - `<configDir>/wazap/wazap.json` keeps {port, apiKey} so the CLI transport
//   and the daemon agree without exposing them on disk in plain env files.
// - `<configDir>/wazap/wazap.pid` records the PID of a detached gateway so
//   `daily-report wazap stop` / `status` can find the process.

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { wazapDir, wazapPidFile } from "../config/paths.mjs";

export const RUNTIME_FILE = "wazap.json";

export function runtimeFile() {
  return join(wazapDir(), RUNTIME_FILE);
}

export function logFile() {
  return join(wazapDir(), "wazap.log");
}

export function ensureWazapDir() {
  const dir = wazapDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function readRuntime() {
  const path = runtimeFile();
  if (!existsSync(path)) {
    throw new Error(
      `Wazap is not installed at ${wazapDir()}. Run \`daily-report install-wazap\` first.`
    );
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Could not parse ${path}: ${err.message}`);
  }
}

export function writeRuntime(data) {
  ensureWazapDir();
  writeFileSync(runtimeFile(), JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function readPid() {
  const path = wazapPidFile();
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8").trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function writePid(pid) {
  ensureWazapDir();
  writeFileSync(wazapPidFile(), String(pid) + "\n", "utf8");
}

export function clearPid() {
  if (existsSync(wazapPidFile())) {
    unlinkSync(wazapPidFile());
  }
}

export function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM"; // EPERM means it exists but we can't signal
  }
}
