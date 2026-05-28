// Cross-platform resolution of the daily-report config directory.
//
// Resolution order (first non-empty wins):
//   1. process.env.DAILY_REPORT_CONFIG_DIR           (test/CI override)
//   2. Linux/macOS: (XDG_CONFIG_HOME || ~/.config) / daily-report
//   3. Windows:     %APPDATA% \ daily-report     (fallback: %USERPROFILE% \ daily-report)
//
// All paths are composed with node:path (never with raw "/" or "\") so the same
// code works on Windows nativo, macOS, and Linux.

import { homedir } from "node:os";
import { join } from "node:path";

const APP_NAME = "daily-report";

export function configDir() {
  const override = process.env.DAILY_REPORT_CONFIG_DIR;
  if (override && override.trim() !== "") {
    return override;
  }

  if (process.platform === "win32") {
    const appdata = process.env.APPDATA;
    if (appdata && appdata.trim() !== "") {
      return join(appdata, APP_NAME);
    }
    return join(homedir(), APP_NAME);
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  const base =
    xdg && xdg.trim() !== "" ? xdg : join(homedir(), ".config");
  return join(base, APP_NAME);
}

export function configFile() {
  return join(configDir(), "config.json");
}

export function wazapDir() {
  return join(configDir(), "wazap");
}

export function wazapPidFile() {
  return join(wazapDir(), "wazap.pid");
}
