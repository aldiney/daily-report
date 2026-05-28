// Resolve the project (working directory) for the report.
//
// Resolution order:
//   1. If `projectName` is given: look up the matching entry in
//      `config.projects` by exact name match, then by prefix match.
//   2. If no name: walk up from `process.cwd()` and return the closest git
//      working tree (`git rev-parse --show-toplevel`); fall back to cwd if
//      there is no git repo.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export function resolveProjectPath({ projectName, config, cwd = process.cwd() } = {}) {
  if (projectName) {
    return resolveByName(projectName, config?.projects ?? []);
  }
  return resolveFromCwd(cwd);
}

function resolveByName(name, projects) {
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error(
      `Project "${name}" was requested but no projects are configured. Run \`daily-report config\` and add it under "projects".`
    );
  }

  const exact = projects.filter((p) => p.name === name);
  if (exact.length === 1) return verifyExists(exact[0].path, name);
  if (exact.length > 1) {
    throw new Error(
      `Project name "${name}" matches more than one entry in config (use a unique name).`
    );
  }

  const lower = name.toLowerCase();
  const partial = projects.filter((p) => p.name.toLowerCase().includes(lower));
  if (partial.length === 1) return verifyExists(partial[0].path, partial[0].name);
  if (partial.length > 1) {
    throw new Error(
      `Ambiguous project name "${name}". Matches: ${partial.map((p) => p.name).join(", ")}.`
    );
  }

  throw new Error(
    `No configured project matches "${name}". Available: ${projects.map((p) => p.name).join(", ") || "(none)"}.`
  );
}

function verifyExists(path, name) {
  if (!path || !existsSync(path)) {
    throw new Error(`Project "${name}" points at "${path}" which does not exist.`);
  }
  return path;
}

function resolveFromCwd(cwd) {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return top || cwd;
  } catch {
    return cwd;
  }
}
