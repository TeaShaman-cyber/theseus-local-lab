#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildPreflight,
  evaluateTransition,
  resolveRuntime,
  runModelSwitchGuard,
  syncFromUsageScout,
} from "./model_switch_guard.mjs";

test("detects model and reasoning-effort changes", () => {
  const transition = evaluateTransition(
    { model: "gpt-5.5", reasoning_effort: "high" },
    { model: "gpt-5.6-sol", reasoning_effort: "medium" },
  );

  assert.equal(transition.status, "changed");
  assert.deepEqual(transition.fields, ["model", "reasoning_effort"]);
});

test("keeps the runtime stable when the hook omits effort", () => {
  const runtime = resolveRuntime(
    { model: "gpt-5.6-sol" },
    {},
    { model: "gpt-5.6-sol", reasoning_effort: "medium" },
  );

  assert.deepEqual(runtime, { model: "gpt-5.6-sol", reasoning_effort: "medium" });
  assert.equal(evaluateTransition(runtime, runtime).changed, false);
});

test("preflight restores memory and shell-routing reflexes", () => {
  const message = buildPreflight(
    { model: "gpt-5.5", reasoning_effort: "high" },
    { model: "gpt-5.6-sol", reasoning_effort: "medium" },
    { status: "changed", changed: true, fields: ["model", "reasoning_effort"] },
  );

  assert.match(message, /AutoMem/);
  assert.match(message, /MemPalace/);
  assert.match(message, /theseus-shell-routing/);
  assert.match(message, /never nested PowerShell -> WSL -> jq/);
  assert.match(message, /workshop dashboard/);
  assert.match(message, /Git warnings/);
});

test("writes one transition event and remains quiet on the next prompt", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "theseus-model-guard-"));
  const statePath = join(workspace, "state.json");

  const first = await runModelSwitchGuard(
    { model: "gpt-5.5", reasoning_effort: "high" },
    { workspace, statePath, sinkUrl: "" },
  );
  const changed = await runModelSwitchGuard(
    { model: "gpt-5.6-sol", reasoning_effort: "medium" },
    { workspace, statePath, sinkUrl: "" },
  );
  const stable = await runModelSwitchGuard(
    { model: "gpt-5.6-sol" },
    { workspace, statePath, sinkUrl: "" },
  );

  assert.equal(first.transition.status, "initialized");
  assert.equal(changed.transition.status, "changed");
  assert.match(changed.preflight, /gpt-5\.5\/high -> gpt-5\.6-sol\/medium/);
  assert.equal(stable.transition.status, "stable");
  assert.equal(stable.preflight, "");

  const timeline = await readFile(changed.timeline.path, "utf8");
  const events = timeline.trim().split("\n").map(JSON.parse);
  assert.equal(events.length, 2);
  assert.equal(events.at(-1).event, "model-runtime-changed");
});

test("syncs stale guard state from usage scout", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "theseus-model-sync-"));
  const statePath = join(workspace, "state.json");
  const usagePath = join(workspace, "usage.json");
  await writeFile(
    statePath,
    `${JSON.stringify({
      model: "gpt-5.6-sol",
      reasoning_effort: "medium",
      observed_at: "2026-07-14T08:21:42.315Z",
    })}\n`,
    "utf8",
  );
  await writeFile(
    usagePath,
    `${JSON.stringify({
      observed_at: "2026-07-15T05:28:19.866Z",
      codex: { model: "gpt-5.5", reasoning_effort: "high" },
    })}\n`,
    "utf8",
  );

  const result = await syncFromUsageScout({ workspace, statePath, usagePath, sinkUrl: "" });
  assert.equal(result.transition.status, "changed");
  assert.deepEqual(result.current, { model: "gpt-5.5", reasoning_effort: "high" });

  const state = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(state.model, "gpt-5.5");
  assert.equal(state.reasoning_effort, "high");
  assert.equal(state.source, "usage-scout");
});
