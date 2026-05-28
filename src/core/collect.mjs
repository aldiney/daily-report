// Orchestrates every source and returns the structured report payload.
// Output shape is the contract consumed by:
//   - src/cli/build.mjs       -> --json output
//   - src/render/*.mjs        -> markdown / humanized markdown
//   - tests/snapshot/*        -> regression baseline

import { resolveDev, todayIso, formatDateBr } from "../resolver/dev.mjs";
import { getRepoFull, getBranch } from "./git-meta.mjs";
import { listCommitsForDay } from "../sources/git-commits.mjs";
import { listGithubIssues } from "../sources/github-issues.mjs";
import { listPendingTodos } from "../sources/todo-pending.mjs";
import { readEmAndamento } from "../sources/em-andamento.mjs";
import { readStuckFromHistorico } from "../sources/travado.mjs";

export function collect({ config, cwd = process.cwd(), authorOverride, date } = {}) {
  if (!config) {
    throw new Error("collect() requires a config object");
  }

  const isoDate = date || todayIso();
  const dev = resolveDev({ config, authorOverride, cwd });
  const sources = config.sources || {};

  const commits = sources.gitLog?.enabled
    ? listCommitsForDay({ author: dev.gitUsername, isoDate, cwd })
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

  return {
    dev,
    repo: getRepoFull(cwd),
    branch: getBranch(cwd),
    date: isoDate,
    dateBr: formatDateBr(isoDate),
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
