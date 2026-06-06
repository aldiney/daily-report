// Orchestrates every source and returns the structured report payload.
// Output shape is the contract consumed by:
//   - src/cli/build.mjs       -> --json output
//   - src/render/*.mjs        -> markdown / humanized markdown
//   - tests/snapshot/*        -> regression baseline

import { resolveDev, formatDateBr, resolveRange } from "../resolver/dev.mjs";
import { getRepoFull, getBranch } from "./git-meta.mjs";
import { listCommitsForRange } from "../sources/git-commits.mjs";
import { listGithubIssues } from "../sources/github-issues.mjs";
import { listPendingTodos } from "../sources/todo-pending.mjs";
import { readEmAndamento } from "../sources/em-andamento.mjs";
import { readStuckFromHistorico } from "../sources/travado.mjs";

export function collect({
  config,
  cwd = process.cwd(),
  authorOverride,
  date,
  since,
  until,
} = {}) {
  if (!config) {
    throw new Error("collect() requires a config object");
  }

  const range = resolveRange({ date, since, until });
  // The end of the window is the reference date for single-day-oriented sources
  // (stuck/historico lookup) and for the backwards-compatible `date` field.
  const isoDate = range.end;
  const dev = resolveDev({ config, authorOverride, cwd });
  const sources = config.sources || {};

  const commits = sources.gitLog?.enabled
    ? listCommitsForRange({
        author: dev.gitUsername,
        since: range.start,
        until: range.end,
        cwd,
      })
    : [];

  let githubIssues = null;
  if (sources.github?.enabled) {
    const repoForIssues = sources.github.repo || getRepoFull(cwd);
    githubIssues = listGithubIssues({ repo: repoForIssues, cwd });
  }

  let todoFile = null;
  if (sources.todoFile?.enabled) {
    todoFile = listPendingTodos({
      todoFilePath: sources.todoFile.path,
      tag: dev.tag,
      cwd,
    });
  }

  let emAndamento = null;
  if (sources.emAndamento?.enabled) {
    emAndamento = readEmAndamento({
      filePath: sources.emAndamento.path,
      cwd,
    });
  }

  let stuck = null;
  if (sources.historico?.enabled) {
    const stuckHeaders = Array.isArray(sources.historico.stuckHeader)
      ? sources.historico.stuckHeader
      : sources.historico.stuckHeader
      ? [sources.historico.stuckHeader]
      : undefined;
    stuck = readStuckFromHistorico({
      historicoDir: config.dev?.historicoDir,
      isoDate,
      headers: stuckHeaders,
      cwd,
    });
  }

  const sinceBr = formatDateBr(range.start);
  const untilBr = formatDateBr(range.end);

  return {
    dev,
    repo: getRepoFull(cwd),
    branch: getBranch(cwd),
    date: isoDate,
    dateBr: untilBr,
    period: {
      since: range.start,
      until: range.end,
      sinceBr,
      untilBr,
      isRange: range.isRange,
      label: range.isRange ? `${sinceBr} → ${untilBr}` : untilBr,
    },
    commits,
    commitsTotal: commits.length,
    pending: {
      githubIssues,
      todoFile,
      emAndamento,
    },
    stuck,
    config: {
      humanize: Boolean(config.render?.humanize),
      version: config.version,
    },
  };
}
