// Source: open GitHub issues assigned to the dev. Requires the `gh` CLI to be
// installed and authenticated. Returns null if gh is unavailable, an empty
// array if gh succeeds with no matches.

import { execFileSync } from "node:child_process";

export function listGithubIssues({ repo, cwd = process.cwd() }) {
  if (!repo) return null;
  let out;
  try {
    out = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--repo",
        repo,
        "--assignee",
        "@me",
        "--state",
        "open",
        "--json",
        "number,title,labels,updatedAt",
        "--limit",
        "50",
      ],
      { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
  } catch {
    return null;
  }
  if (!out) return [];
  try {
    const parsed = JSON.parse(out);
    return parsed.map((it) => ({
      number: it.number,
      title: it.title,
      labels: (it.labels || []).map((l) => l.name),
      updatedAt: it.updatedAt,
    }));
  } catch {
    return null;
  }
}
