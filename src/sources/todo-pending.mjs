// Source: lines in a markdown TODO file that match a user-defined tag.
// Used to surface user-owned pending items in the daily report.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// `tag` is matched case-insensitively as a substring of each unchecked todo
// line. The tag MUST already include the user's preferred prefix - the source
// does not assume "@firstname"; it is configured via config.dev.tag.
export function listPendingTodos({ todoFilePath, tag, cwd = process.cwd() }) {
  if (!todoFilePath || !tag) return [];
  const abs = resolve(cwd, todoFilePath);
  if (!existsSync(abs)) return [];
  const content = readFileSync(abs, "utf8");
  const needle = tag.toLowerCase();
  return content
    .split("\n")
    .filter((line) => line.includes("- [ ]") && line.toLowerCase().includes(needle))
    .map((line) => line.trim());
}
