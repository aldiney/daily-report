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

test("collect() with --since/--until produces a range period", () => {
  const fix = buildFixture({ date: "2026-05-28" });
  try {
    const cfg = defaultConfig();
    cfg.dev.gitUsername = fix.author;
    cfg.evolution.url = "http://example.com";
    cfg.evolution.instance = "inst";
    cfg.evolution.apiKey = "k";

    const data = collect({
      config: cfg,
      cwd: fix.cwd,
      since: "2026-05-27",
      until: "2026-05-29",
    });

    assert.equal(data.period.isRange, true);
    assert.equal(data.period.since, "2026-05-27");
    assert.equal(data.period.until, "2026-05-29");
    assert.equal(data.period.label, "27/05/2026 → 29/05/2026");
    // Reference date (single-day sources, dateBr) tracks the end of the window.
    assert.equal(data.date, "2026-05-29");
    assert.equal(data.dateBr, "29/05/2026");
    // All three fixture commits land on 2026-05-28, inside the range.
    assert.equal(data.commitsTotal, 3);
  } finally {
    rmSync(fix.cwd, { recursive: true, force: true });
  }
});

test("collect() single day fills period with isRange=false", () => {
  const fix = buildFixture({ date: "2026-05-28" });
  try {
    const cfg = defaultConfig();
    cfg.dev.gitUsername = fix.author;
    cfg.evolution.url = "http://example.com";
    cfg.evolution.instance = "inst";
    cfg.evolution.apiKey = "k";

    const data = collect({ config: cfg, cwd: fix.cwd, date: "2026-05-28" });

    assert.equal(data.period.isRange, false);
    assert.equal(data.period.label, "28/05/2026");
    assert.equal(data.period.since, "2026-05-28");
    assert.equal(data.period.until, "2026-05-28");
  } finally {
    rmSync(fix.cwd, { recursive: true, force: true });
  }
});
