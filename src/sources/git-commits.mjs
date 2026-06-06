// Source: today's commits authored by the configured dev, categorized by
// conventional-commit type (feat/fix/refactor/...).

import { execFileSync } from "node:child_process";

export const COMMIT_TYPE_REGEX =
  /^(feat|fix|refactor|docs|chore|test|style|perf|build|ci|revert|release|merge)(\([^)]+\))?(!)?:\s*/i;

export function categorizeCommit(subject) {
  const m = subject.match(COMMIT_TYPE_REGEX);
  if (!m) return { type: "other", scope: null, message: subject };
  return {
    type: m[1].toLowerCase(),
    scope: m[2] ? m[2].slice(1, -1) : null,
    message: subject.slice(m[0].length).trim(),
  };
}

// Returns an array of `{ hash, subject, type, scope, message }` for commits
// authored by `author` between `since` and `until` (inclusive, by calendar day)
// in the repo at `cwd`. Empty array on no matches or git errors.
export function listCommitsForRange({ author, since, until, cwd = process.cwd() }) {
  let out;
  try {
    out = execFileSync(
      "git",
      [
        "log",
        `--author=${author}`,
        `--since=${since} 00:00`,
        `--until=${until} 23:59`,
        "--pretty=format:%H%x09%s",
      ],
      { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
  } catch {
    return [];
  }
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) return null;
      const hash = line.slice(0, tab);
      const subject = line.slice(tab + 1);
      const cat = categorizeCommit(subject);
      return {
        hash: hash.slice(0, 8),
        subject,
        type: cat.type,
        scope: cat.scope,
        message: cat.message,
      };
    })
    .filter(Boolean);
}

// Backwards-compatible single-day helper (delegates to the range version).
export function listCommitsForDay({ author, isoDate, cwd = process.cwd() }) {
  return listCommitsForRange({ author, since: isoDate, until: isoDate, cwd });
}
