// Repository metadata helpers: git user.name, remote origin, current branch.
// All commands respect the provided cwd so build-summary can run against an
// arbitrary project, not just the one daily-report itself lives in.

import { execFileSync } from "node:child_process";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    encoding: "utf8",
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function gitUserName(cwd = process.cwd()) {
  try {
    return runGit(["config", "user.name"], cwd);
  } catch {
    return "";
  }
}

// Returns "owner/repo" parsed from the origin URL, or null if there is no
// remote or the URL does not match the expected pattern. Works with SSH
// (`git@host:org/repo.git`), HTTPS (`https://host/org/repo.git`) and SSH
// aliases (`git@alias:org/repo.git`).
export function getRepoFull(cwd = process.cwd()) {
  try {
    const url = runGit(["remote", "get-url", "origin"], cwd);
    const m = url.match(/[:/]([^:/]+\/[^:/]+?)(?:\.git)?$/);
    return m ? m[1] : url;
  } catch {
    return null;
  }
}

export function getBranch(cwd = process.cwd()) {
  try {
    const b = runGit(["branch", "--show-current"], cwd);
    return b || "(detached)";
  } catch {
    return null;
  }
}
