#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeEvents, renderMarkdown } from "./learning_loop.mjs";

test("turns blocked tool-policy events into concrete proposals", () => {
  const summary = analyzeEvents([
    {
      decision: {
        verdict: "block",
        reason: "raw-docker-shell",
        reinforcement: { kind: "friction" },
      },
      action: { command: "docker ps" },
    },
    {
      decision: {
        verdict: "block",
        reason: "raw-powershell-script",
        reinforcement: { kind: "friction" },
      },
      action: { command: "pwsh -File scripts/status.ps1" },
    },
  ]);

  assert.equal(summary.event_count, 2);
  assert.equal(summary.verdicts.block, 2);
  assert.equal(summary.reasons["raw-docker-shell"], 1);
  assert.ok(summary.proposals.some((proposal) => proposal.includes("raw Docker CLI available")));
  assert.ok(summary.proposals.some((proposal) => proposal.includes("PowerShell")));
});

test("detects bad-fit all-skills route and recommends skill-router", () => {
  const summary = analyzeEvents([
    {
      ranking: {
        winner: { id: "router", command: "use theseus-skill-router then load one matching skill" },
        ranked: [
          { id: "router", scores: { task_fit: 3 } },
          { id: "all-skills", scores: { task_fit: -3 } },
        ],
      },
    },
  ]);

  assert.equal(summary.winners["use theseus-skill-router then load one matching skill"], 1);
  assert.equal(summary.reasons["bad-fit:all-skills"], 1);
  assert.ok(summary.proposals.some((proposal) => proposal.includes("skill-router")));
});

test("renders a compact markdown report", () => {
  const markdown = renderMarkdown(
    {
      event_count: 1,
      parse_errors: 0,
      verdicts: { allow: 1 },
      reasons: { "known-safe-wrapper": 1 },
      reinforcement: { reward: 1 },
      winners: {},
      proposals: ["Keep the current wrapper route."],
    },
    { days: 7 },
  );

  assert.match(markdown, /Theseus Learning Loop/);
  assert.match(markdown, /known-safe-wrapper: 1/);
  assert.match(markdown, /Keep the current wrapper route/);
});
