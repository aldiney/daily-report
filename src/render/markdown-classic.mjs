// Classic markdown rendering: raw commit list, raw pending bullets. This is
// the format the `/daily-report` skill receives when `config.render.humanize`
// is disabled, and what `daily-report send` uses by default when no skill is
// in the loop.

export function renderClassic(data) {
  const { dev, dateBr, commits, pending, stuck, commitsTotal, repo, branch } = data;
  const period = data.period || { isRange: false, label: dateBr };

  const projectLine = repo
    ? `Project: ${repo}${branch ? ` - branch: ${branch}` : ""}`
    : null;

  const doneLines =
    commits.length > 0
      ? commits.map((c) => `- ${c.subject} (${c.hash})`).join("\n")
      : "_(nothing committed)_";

  const pendingParts = [];
  if (pending.githubIssues && pending.githubIssues.length > 0) {
    for (const i of pending.githubIssues) {
      pendingParts.push(`- #${i.number} ${i.title}`);
    }
  }
  if (pending.todoFile && pending.todoFile.length > 0) {
    for (const l of pending.todoFile) pendingParts.push(l);
  }
  if (pending.emAndamento) {
    pendingParts.push(`- ${pending.emAndamento.split("\n").join("\n  ")}`);
  }
  const pendingText = pendingParts.length > 0 ? pendingParts.join("\n") : "_(nothing)_";

  const stuckText = stuck || "_(nothing)_";

  const title = period.isRange
    ? `*Report ${dev.displayName} - ${period.label}*`
    : `*Daily ${dev.displayName} - ${period.label}*`;

  const lines = [
    title,
    ...(projectLine ? [projectLine] : []),
    "",
    "*Done today*",
    doneLines,
    "",
    "*Pending / In progress*",
    pendingText,
    "",
    "*Stuck*",
    stuckText,
    "",
    `Total commits: ${commitsTotal}`,
    "",
  ];

  return lines.join("\n");
}
