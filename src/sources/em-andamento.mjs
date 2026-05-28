// Source: free-form "currently working on" note. By convention this lives in
// a single markdown file the user maintains by hand. If the file contains an
// "## Em andamento" / "## In progress" header, only that section is returned;
// otherwise the whole file body.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SECTION_HEADERS = ["em andamento", "in progress"];

export function readEmAndamento({ filePath, cwd = process.cwd() }) {
  if (!filePath) return null;
  const abs = resolve(cwd, filePath);
  if (!existsSync(abs)) return null;
  const content = readFileSync(abs, "utf8");
  const section = extractSection(content);
  if (section !== null) return section;
  const trimmed = content.trim();
  return trimmed || null;
}

function extractSection(content) {
  const lines = content.split(/\r?\n/);
  let inSection = false;
  const body = [];
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      if (inSection) break;
      const title = headerMatch[1].trim().toLowerCase();
      if (SECTION_HEADERS.some((h) => title === h || title.startsWith(h + " "))) {
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
