// Resolve the dev profile (display name + tag) for the current report.
// All identity comes from the user config; there is no hardcoded map.

import { gitUserName } from "../core/git-meta.mjs";

export function resolveDev({ config, authorOverride, cwd = process.cwd() }) {
  const gitUsername = authorOverride || config?.dev?.gitUsername || gitUserName(cwd);
  const displayName = config?.dev?.displayName || gitUsername || "unknown";
  const tag = config?.dev?.tag || "";
  return { gitUsername, displayName, tag };
}

export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function formatDateBr(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
