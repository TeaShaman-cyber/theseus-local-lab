#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { artifactSummary, delta, lensSummary, usageSummary } from "./lens_usage_trial.mjs";

test("summarizes the binding usage limit", () => {
  const summary = usageSummary({
    observed_at: "2026-07-14T22:00:00Z",
    codex: { model: "gpt-5.5", reasoning_effort: "medium" },
    derived: { binding_limit_key: "codex:10080:primary" },
    limits: [
      { key: "codex:10080:primary", used_percent: 14, remaining_percent_derived: 86, window_minutes: 10080 },
    ],
    tokens: {
      session_cumulative: { total: 1000 },
      last_event: { total: 10 },
    },
  });

  assert.equal(summary.used_percent, 14);
  assert.equal(summary.session_total_tokens, 1000);
});

test("computes usage deltas", () => {
  assert.deepEqual(
    delta({ used_percent: 14, session_total_tokens: 1000 }, { used_percent: 15, session_total_tokens: 1450 }),
    { used_percent_delta: 1, session_total_tokens_delta: 450 },
  );
});

test("summarizes source lens metrics", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "lens-usage-trial-"));
  const filePath = path.join(dir, "lens.json");
  try {
    writeFileSync(
      filePath,
      JSON.stringify({
        schema: "theseus.source_lens.v1",
        source: { filename: "results.json" },
        extraction: {
          status: "lens_ready",
          source_count: 5,
          claim_count: 3,
          estimated_source_tokens: 1000,
        },
        compression: { estimated_lens_tokens: 250, ratio: 4 },
      }),
      "utf8",
    );

    const summary = lensSummary(filePath);
    assert.equal(summary.schema, "theseus.source_lens.v1");
    assert.equal(summary.source_count, 5);
    assert.equal(summary.ratio, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("summarizes output artifacts without reading their contents", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "lens-usage-artifact-"));
  const filePath = path.join(dir, "result.md");
  try {
    writeFileSync(filePath, "# Result\n", "utf8");

    const summary = artifactSummary(filePath);
    assert.equal(summary.path, filePath);
    assert.equal(summary.bytes, 9);
    assert.match(summary.modified_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
