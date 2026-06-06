// Humanized markdown rendering: commits grouped by conventional-commit type
// (feat -> fix -> refactor -> docs -> ...), with one line per group describing
// "N <type>: <comma-separated messages>". This is the default render when
// `config.render.humanize` is true.
//
// The `/daily-report` Claude Code skill can override this with LLM-driven
// humanization; this implementation gives the same shape deterministically
// without an LLM in the loop.

const TYPE_ORDER = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "docs",
  "test",
  "chore",
  "build",
  "ci",
  "style",
  "revert",
  "release",
  "merge",
  "other",
];

export function renderHumanized(data) {
  const { dev, dateBr, commits, pending, stuck, commitsTotal, repo, branch } = data;
  const period = data.period || { isRange: false, label: dateBr };

  const projectLine = repo
    ? `Project: ${repo}${branch ? ` - branch: ${branch}` : ""}`
    : null;

  const doneBlock = commits.length > 0 ? humanizeCommits(commits) : "_(nothing committed)_";

  const pendingBlock = renderPendingBlock(pending);

  const stuckBlock = stuck || "_(nothing)_";

  const title = period.isRange
    ? `*Report ${dev.displayName} - ${period.label}*`
    : `*Daily ${dev.displayName} - ${period.label}*`;

  const lines = [
    title,
    ...(projectLine ? [projectLine] : []),
    "",
    "*Done today*",
    doneBlock,
    "",
    "*Pending / In progress*",
    pendingBlock,
    "",
    "*Stuck*",
    stuckBlock,
    "",
    `Total commits: ${commitsTotal}`,
    "",
  ];

  return lines.join("\n");
}

// Returns a multi-line string with one bullet per commit type.
export function humanizeCommits(commits) {
  const groups = new Map();
  for (const c of commits) {
    const key = c.type || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const ordered = TYPE_ORDER.filter((t) => groups.has(t)).concat(
    [...groups.keys()].filter((t) => !TYPE_ORDER.includes(t))
  );
  return ordered
    .map((type) => {
      const items = groups.get(type);
      const summaries = items
        .map((c) => (c.message || c.subject).trim())
        .filter(Boolean);
      const joined = summaries.length === 1 ? summaries[0] : summaries.join("; ");
      return `- ${items.length} ${type}: ${joined}`;
    })
    .join("\n");
}

function renderPendingBlock(pending) {
  const lines = [];
  if (pending.githubIssues && pending.githubIssues.length > 0) {
    const titles = pending.githubIssues
      .map((i) => `#${i.number} (${truncate(i.title, 40)})`)
      .join(", ");
    lines.push(`- ${pending.githubIssues.length} open GitHub issues: ${titles}`);
  }
  if (pending.todoFile && pending.todoFile.length > 0) {
    const summary = pending.todoFile
      .map((l) => stripTodoMarker(l))
      .filter(Boolean)
      .map((l) => truncate(l, 40))
      .join("; ");
    lines.push(`- ${pending.todoFile.length} items in your TODO file: ${summary}`);
  }
  if (pending.emAndamento) {
    const firstLine = pending.emAndamento.split(/\r?\n/)[0].trim();
    lines.push(`- 1 em-andamento note: ${truncate(firstLine, 80)}`);
  }
  if (lines.length === 0) return "_(nothing)_";
  return lines.join("\n");
}

function stripTodoMarker(line) {
  return line.replace(/^[-*]\s*\[[\sxX]\]\s*/, "").trim();
}

function truncate(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "...";
}
