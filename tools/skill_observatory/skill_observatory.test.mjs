#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PARETO_THRESHOLD, GOLDEN_COVERAGE_TARGET, GOLDEN_RATIO, expectedSkills, paretoFocus } from "./skill_observatory.mjs";

test("keeps trivial chat out of skill telemetry", () => {
  assert.deepEqual(expectedSkills("thanks"), []);
});

test("maps Docker work to memory plus shell hygiene", () => {
  const skills = expectedSkills("Please inspect Docker Desktop and the AutoMem container logs after the WSL restart.");
  assert.ok(skills.includes("theseus-memory-stack"));
  assert.ok(skills.includes("theseus-shell-routing"));
  assert.ok(skills.includes("local-agent-hygiene"));
});

test("maps Git research work to the relevant route set", () => {
  const skills = expectedSkills("Find GitHub issues and research the best migration route before committing the WSL changes.");
  assert.ok(skills.includes("theseus-git-hygiene"));
  assert.ok(skills.includes("theseus-plugin-conclave"));
});

test("uses Pareto focus with a bounded review budget", () => {
  assert.equal(DEFAULT_PARETO_THRESHOLD, 0.8);
  const result = paretoFocus({ powershell: 8, docker: 2, git: 1, wsl: 1 });
  assert.equal(result.focus.length, 2);
  assert.equal(result.focus[0].id, "powershell");
  assert.equal(result.focus[0].cumulative_share, 0.667);
  assert.equal(result.focus[1].id, "docker");
  assert.equal(result.focus[1].cumulative_share, 0.833);
  assert.equal(result.deferred.length, 2);
});

test("uses the reciprocal golden ratio as a separate concentration diagnostic", () => {
  assert.equal(Number(GOLDEN_RATIO.toFixed(6)), 1.618034);
  assert.equal(Number(GOLDEN_COVERAGE_TARGET.toFixed(6)), 0.618034);
  const result = paretoFocus({ powershell: 8, docker: 2, git: 1, wsl: 1 }, GOLDEN_COVERAGE_TARGET);
  assert.equal(result.focus.length, 1);
  assert.equal(result.focus[0].id, "powershell");
});
