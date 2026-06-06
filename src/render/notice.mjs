// Informational notice printed when the CLI renders a report for a human in a
// plain terminal (i.e. no AI agent in the loop). The CLI alone can only build
// a deterministic, grouped summary; truly natural-language, human-friendly
// reports come from the `/daily-report` skill running under Claude Code (or
// another AI agent), which rewrites the commits as prose before sending.
//
// It is written to STDERR so it never contaminates the report on stdout
// (piping `build --md` or `send --dry-run` stays clean).

export const NATURAL_LANGUAGE_NOTICE = [
  "note: terminal mode - this is the deterministic summary.",
  "      Friendly, natural-language reports are only available when you run the",
  "      /daily-report skill through Claude Code (or another AI agent).",
].join("\n");

export function writeNaturalLanguageNotice(stream = process.stderr) {
  stream.write(NATURAL_LANGUAGE_NOTICE + "\n");
}
