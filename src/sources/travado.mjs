// Source: the "Stuck" / "Blocked" section of the most recent file in the
// user's history folder for the given date. Returns null if the folder does
// not exist, no file for the date exists, or the section is missing.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const DEFAULT_HEADERS = ["Travado", "Bloqueado", "Stuck", "Blocked"];

export function readStuckFromHistorico({
  historicoDir,
  isoDate,
  headers = DEFAULT_HEADERS,
  cwd = process.cwd(),
}) {
  if (!historicoDir) return null;
  const absDir = resolve(cwd, historicoDir);
  if (!existsSync(absDir)) return null;
  const files = readdirSync(absDir)
    .filter((f) => f.startsWith(isoDate) && f.endsWith(".md"))
    .sort();
  if (files.length === 0) return null;
  const content = readFileSync(join(absDir, files[files.length - 1]), "utf8");
  return extractSection(content, headers);
}

// Walks the markdown line by line, finds the first `## <one-of-headers>`
// header, and returns the body up to the next `## ` header (or EOF).
// Robust against \Z (which is not a valid end-of-string anchor in JS regex).
function extractSection(content, headers) {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const lines = content.split(/\r?\n/);
  let inSection = false;
  const body = [];
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      if (inSection) break; // next header ends the section
      const title = headerMatch[1].trim().toLowerCase();
      if (normalized.some((h) => title === h || title.startsWith(h + " "))) {
        inSection = true;
        continue;
      }
    } else if (inSection) {
      body.push(line);
    }
  }
  if (!inSection) return null;
  const text = body.join("\n").trim();
  return text || null;
}
