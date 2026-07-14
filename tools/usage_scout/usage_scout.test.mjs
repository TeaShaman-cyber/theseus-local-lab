#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { collectUsageSnapshot, normalizeSnapshot, selectLatestRecords } from "./usage_scout.mjs";

function fixtureLines(rateLimits = {}) {
  return [
    JSON.stringify({
      timestamp: "2026-07-14T08:00:00.000Z",
      type: "turn_context",
      payload: { model: "gpt-5.6-sol", effort: "medium" },
    }),
    JSON.stringify({
      timestamp: "2026-07-14T08:01:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 100, cached_input_tokens: 60, output_tokens: 20, total_tokens: 120 },
          total_token_usage: { input_tokens: 1000, cached_input_tokens: 600, output_tokens: 200, total_tokens: 1200 },
          model_context_window: 200000,
        },
        rate_limits: rateLimits,
      },
    }),
  ];
}

test("normalizes weekly primary without assuming it is a five-hour limit", () => {
  const records = selectLatestRecords(
    fixtureLines({
      limit_id: "codex",
      plan_type: "plus",
      primary: { used_percent: 91, window_minutes: 10080, resets_at: 1784102400 },
      secondary: null,
    }),
  );
  const snapshot = normalizeSnapshot(records, new Date("2026-07-14T08:02:00.000Z"));

  assert.equal(snapshot.codex.model, "gpt-5.6-sol");
  assert.equal(snapshot.codex.reasoning_effort, "medium");
  assert.equal(snapshot.limits[0].window_minutes, 10080);
  assert.equal(snapshot.limits[0].wire_slot, "primary");
  assert.equal(snapshot.limits[0].remaining_percent_derived, 9);
  assert.equal(snapshot.derived.binding_limit_key, "codex:10080:primary");
  assert.equal(snapshot.account.plan_type, "plus");
});

test("treats missing rate limits as unknown rather than zero", () => {
  const records = selectLatestRecords(fixtureLines(null));
  const snapshot = normalizeSnapshot(records);

  assert.deepEqual(snapshot.limits, []);
  assert.equal(snapshot.derived.confidence, "none");
  assert.equal(snapshot.credits.balance, null);
  assert.ok(snapshot.quality.warnings.includes("rate-limits-missing"));
});

test("writes history only when the observed source event changes", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "theseus-usage-scout-"));
  const outputDir = join(workspace, "outputs", "usage_scout");
  const rolloutPath = join(workspace, "rollout.jsonl");
  await writeFile(
    rolloutPath,
    `${fixtureLines({ primary: { used_percent: 20, window_minutes: 300 } }).join("\n")}\n`,
  );

  const options = {
    workspace,
    outputDir,
    rollout: { path: rolloutPath, size: 1 },
    now: new Date("2026-07-14T08:02:00.000Z"),
    sinkUrl: "",
  };
  const first = await collectUsageSnapshot(options);
  const second = await collectUsageSnapshot(options);

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  const history = await readFile(join(outputDir, "2026-07-14.jsonl"), "utf8");
  assert.equal(history.trim().split("\n").length, 1);
});
