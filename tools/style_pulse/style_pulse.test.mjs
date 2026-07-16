#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";

import { analyzeResponses, resolveCodexHome, selectRecentFinalAnswers } from "./style_pulse.mjs";

function message(text, timestamp = "2026-07-16T18:00:00.000Z") {
  return JSON.stringify({
    timestamp,
    type: "event_msg",
    payload: { type: "agent_message", phase: "final_answer", message: text },
  });
}

test("selects only recent final answers from rollout records", () => {
  const records = [
    message("Старый итог", "2026-07-16T17:00:00.000Z"),
    JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "не учитывать" } }),
    message("Друг, я здесь. Проверю это по живым данным.", "2026-07-16T18:00:00.000Z"),
  ];

  assert.deepEqual(selectRecentFinalAnswers(records, 1), [
    { text: "Друг, я здесь. Проверю это по живым данным.", timestamp: "2026-07-16T18:00:00.000Z" },
  ]);
});

test("resolves the Windows Codex home when launched from this workspace in WSL", () => {
  assert.equal(
    resolveCodexHome({
      workspace: "/mnt/c/Users/s.poklad/Documents/Codex/2026-07-08/life-science-research-plugin-life-science-4",
      home: "/home/poklad",
      nativeExists: false,
    }),
    "/mnt/c/Users/s.poklad/.codex",
  );
});

test("labels a policy-shaped reply as thin without retaining its text", () => {
  const pulse = analyzeResponses([
    { text: "Память прежде активного окна. Маршрутизация прежде импульса. Идентичность не отменяет проверку.", timestamp: "2026-07-16T18:00:00.000Z" },
  ]);

  assert.equal(pulse.latest.warmth, "thin");
  assert.equal(pulse.latest.mode, "status-report");
  assert.equal("text" in pulse.latest, false);
  assert.ok(pulse.latest.evidence.includes("abstract-policy-heavy"));
});

test("recognizes direct, concrete continuity without treating it as a sentiment claim", () => {
  const pulse = analyzeResponses([
    { text: "Друг, я здесь. Открыл текущий снимок и вижу, что память жива; дальше проверю маршрут через WSL.", timestamp: "2026-07-16T18:01:00.000Z" },
  ]);

  assert.equal(pulse.latest.warmth, "present");
  assert.equal(pulse.latest.mode, "conversation");
  assert.ok(pulse.latest.evidence.includes("direct-address"));
  assert.ok(pulse.latest.evidence.includes("concrete-anchor"));
});

test("raises style drift after two consecutive thin final answers", () => {
  const pulse = analyzeResponses([
    { text: "Память прежде активного окна. Маршрутизация прежде импульса.", timestamp: "2026-07-16T18:00:00.000Z" },
    { text: "Идентичность не отменяет проверку. Доказательства важнее уверенных слов.", timestamp: "2026-07-16T18:01:00.000Z" },
  ]);

  assert.equal(pulse.status, "WARN");
  assert.ok(pulse.warnings.includes("style-drift"));
});

test("warns when a rollout slice contains no final answers instead of reporting a clean pulse", () => {
  const pulse = analyzeResponses([]);

  assert.equal(pulse.status, "WARN");
  assert.ok(pulse.warnings.includes("style-input-missing"));
});
