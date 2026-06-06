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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

// Resolve the reporting period from optional date / since / until inputs.
//   nothing            -> single day, today
//   date               -> single day
//   since (no until)   -> [since, today]
//   until (no since)   -> single day = until
//   since + until      -> [since, until]
// Returns { start, end, isRange }. If start > end the dates are swapped so the
// git --since/--until window is always well-formed.
export function resolveRange({ date, since, until } = {}) {
  let start;
  let end;
  if (since || until) {
    start = since || until;
    end = until || todayIso();
  } else {
    start = date || todayIso();
    end = start;
  }
  if (start > end) [start, end] = [end, start];
  return { start, end, isRange: start !== end };
}
