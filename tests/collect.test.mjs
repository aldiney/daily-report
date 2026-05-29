// Snapshot test for `collect()`. Builds a deterministic mini-repo, runs
// collect, normalizes hashes, and asserts the result matches the baseline
// at tests/snapshot/collect.snapshot.json. Update the baseline (after
// reviewing the diff!) with:
//   UPDATE_SNAPSHOTS=1 node --test tests/collect.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { collect } from "../src/core/collect.mjs";
import { defaultConfig } from "../src/config/schema.mjs";
import { buildFixture, normalizeForSnapshot } from "./helpers/fixture.mjs";

const SNAPSHOT_PATH = new URL("./snapshot/collect.snapshot.json", import.meta.url);

test("collect() against fixture mini-repo matches baseline", () => {
  const fix = buildFixture({ date: "2026-05-28" });
  try {
    const cfg = defaultConfig();
    cfg.dev.gitUsername = fix.author;
    cfg.dev.displayName = "Alice Smith";
    cfg.dev.tag = "@alice";
    cfg.dev.historicoDir = "docs/historico";
    cfg.evolution.url = "http://example.com";
    cfg.evolution.instance = "inst";
    cfg.evolution.apiKey = "k";
    cfg.sources.todoFile.path = "docs/TODO_pending.md";
    cfg.sources.emAndamento.enabled = true;
    cfg.sources.emAndamento.path = "em.md";
    cfg.sources.historico.enabled = true;

    const data = collect({ config: cfg, cwd: fix.cwd, date: fix.date });
    const actual = normalizeForSnapshot(data);
    const actualStr = JSON.stringify(actual, null, 2) + "\n";

    if (process.env.UPDATE_SNAPSHOTS === "1") {
      writeFileSync(SNAPSHOT_PATH, actualStr);
      return;
    }

    if (!existsSync(SNAPSHOT_PATH)) {
      writeFileSync(SNAPSHOT_PATH, actualStr);
      assert.fail(
        `snapshot did not exist; created at ${SNAPSHOT_PATH}. Review and commit.`
      );
    }

    const expected = readFileSync(SNAPSHOT_PATH, "utf8");
    assert.equal(actualStr, expected, "collect() output diverged from snapshot");
  } finally {
    rmSync(fix.cwd, { recursive: true, force: true });
  }
});

test("collect() throws when config is missing", () => {
  assert.throws(() => collect({ cwd: "/tmp", date: "2026-05-28" }), /config/);
});
