// Helper that builds a deterministic mini git repo in a tmp directory.
// Used by snapshot tests to validate `collect()` end-to-end.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const AUTHOR_NAME = "alice";
const AUTHOR_EMAIL = "alice@example.test";

export function buildFixture({ date = "2026-05-28" } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "daily-report-fix-"));
  run("git", ["init", "-q", "-b", "main"], cwd);
  run("git", ["config", "user.name", AUTHOR_NAME], cwd);
  run("git", ["config", "user.email", AUTHOR_EMAIL], cwd);

  // Commit 1: feat with scope
  writeFileSync(join(cwd, "a.txt"), "v1\n");
  commit(cwd, "feat(ui): adicionar botao salvar", `${date}T10:00:00`);

  // Commit 2: fix without scope
  writeFileSync(join(cwd, "a.txt"), "v1\nv2\n");
  commit(cwd, "fix: corrigir validacao de email", `${date}T14:00:00`);

  // Commit 3: docs without scope
  writeFileSync(join(cwd, "a.txt"), "v1\nv2\nv3\n");
  commit(cwd, "docs: atualizar README", `${date}T16:30:00`);

  // TODO file
  mkdirSync(join(cwd, "docs"), { recursive: true });
  writeFileSync(
    join(cwd, "docs", "TODO_pending.md"),
    [
      "# TODO",
      "",
      "- [ ] @alice revisar PR #15",
      "- [ ] @bob outra coisa que nao e minha",
      "- [ ] @alice escrever testes",
      "- [x] @alice tarefa antiga concluida",
      "",
    ].join("\n")
  );

  // em-andamento
  writeFileSync(
    join(cwd, "em.md"),
    [
      "# notas",
      "",
      "## Em andamento",
      "refatorando o login",
      "",
      "## Outra coisa",
      "bla",
      "",
    ].join("\n")
  );

  // Stuck section in history
  mkdirSync(join(cwd, "docs", "historico"), { recursive: true });
  writeFileSync(
    join(cwd, "docs", "historico", `${date}-daily.md`),
    [
      `# Daily ${date}`,
      "",
      "## Feito hoje",
      "- aaa",
      "",
      "## Travado",
      "Aguardando a equipe de design responder sobre o layout do botao.",
      "",
    ].join("\n")
  );

  return { cwd, author: AUTHOR_NAME, date };
}

function commit(cwd, subject, isoDateTime) {
  run("git", ["add", "-A"], cwd);
  run(
    "git",
    ["commit", "-q", "-m", subject],
    cwd,
    {
      GIT_AUTHOR_NAME: AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
      GIT_COMMITTER_NAME: AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
      GIT_AUTHOR_DATE: isoDateTime,
      GIT_COMMITTER_DATE: isoDateTime,
    }
  );
}

function run(cmd, args, cwd, env) {
  execFileSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  });
}

// Normalizes the collect() output for snapshot comparison:
// - Replaces commit hashes with "<hash>" placeholders.
// - Sorts/normalizes anything else that could be machine-dependent.
export function normalizeForSnapshot(data) {
  const out = JSON.parse(JSON.stringify(data));
  if (Array.isArray(out.commits)) {
    out.commits = out.commits.map((c) => ({ ...c, hash: "<hash>" }));
  }
  return out;
}
