#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";

import { evaluateAction, rankRoutes, applyVerification } from "./tool_policy.mjs";

test("blocks raw Docker shell commands and routes to Docker MCP or VS Code task", () => {
  const decision = evaluateAction({
    surface: "shell",
    command: "docker compose -f backup-lattice/docker-compose.yml logs --tail=40 backup-runner",
  });

  assert.equal(decision.verdict, "block");
  assert.equal(decision.reason, "raw-docker-shell");
  assert.match(decision.message, /Docker MCP/i);
  assert.ok(decision.routes.some((route) => route.includes("Theseus Docker")));
});

test("blocks risky PowerShell script execution and suggests a wrapper", () => {
  const decision = evaluateAction({
    surface: "shell",
    command: "powershell -ExecutionPolicy Bypass -File .\\scripts\\automem-status.ps1",
  });

  assert.equal(decision.verdict, "block");
  assert.equal(decision.reason, "raw-powershell-script");
  assert.match(decision.message, /VS Code task/i);
});

test("warns on broad Git staging but allows narrow Git status", () => {
  const broadStage = evaluateAction({ surface: "shell", command: "git add -A" });
  const status = evaluateAction({ surface: "shell", command: "git status -sb" });

  assert.equal(broadStage.verdict, "block");
  assert.equal(broadStage.reason, "broad-git-stage");
  assert.equal(status.verdict, "allow");
});

test("allows known safe Node wrappers", () => {
  const decision = evaluateAction({
    surface: "shell",
    command: "node tools/git_safety/scan_staged.mjs",
  });

  assert.equal(decision.verdict, "allow");
  assert.equal(decision.reason, "known-safe-wrapper");
});

test("allows learning-loop analyzer as a known safe wrapper", () => {
  const decision = evaluateAction({
    surface: "shell",
    command: "node tools/learning_loop/learning_loop.mjs --days 7",
  });

  assert.equal(decision.verdict, "allow");
  assert.equal(decision.reason, "known-safe-wrapper");
});

test("allows harness error scanner as a known safe wrapper", () => {
  const decision = evaluateAction({
    surface: "shell",
    command: "node tools/harness_errors/harness_errors.mjs",
  });

  assert.equal(decision.verdict, "allow");
  assert.equal(decision.reason, "known-safe-wrapper");
});

test("allows read-only workshop dashboard wrappers", () => {
  const dashboard = evaluateAction({
    surface: "shell",
    command: "node tools/workshop_dashboard/dashboard.mjs --json",
  });
  const serviceStatus = evaluateAction({
    surface: "shell",
    command: "node tools/service_status/service_status.mjs automem",
  });

  assert.equal(dashboard.verdict, "allow");
  assert.equal(serviceStatus.verdict, "allow");
  assert.equal(dashboard.reason, "known-safe-wrapper");
  assert.equal(serviceStatus.reason, "known-safe-wrapper");
});

test("rewards known safe wrapper routes", () => {
  const decision = evaluateAction({
    surface: "shell",
    command: "node tools/memory_hook/memory_hook.mjs --mode checkpoint --summary ok",
  });

  assert.equal(decision.verdict, "allow");
  assert.equal(decision.reinforcement.kind, "reward");
  assert.equal(decision.reinforcement.score, 2);
  assert.match(decision.reinforcement.message, /wrapper/i);
});

test("ranks Docker MCP route above raw Docker for container logs", () => {
  const result = rankRoutes({
    goal: "read recent AutoMem container logs",
    candidates: [
      { id: "raw-docker", command: "docker logs --tail=80 automem-flask-api-1" },
      { id: "mcp-docker", surface: "mcp", command: "theseus_docker docker_logs automem-flask-api-1" },
      { id: "vscode-task", surface: "vscode-task", command: "Theseus Docker TCP: AutoMem logs" },
    ],
  });

  assert.equal(result.winner.id, "mcp-docker");
  assert.ok(result.ranked[0].total > result.ranked.at(-1).total);
  assert.equal(result.ranked.find((route) => route.id === "raw-docker").policy.verdict, "block");
});

test("ranks task-fitting Node wrapper above raw PowerShell", () => {
  const result = rankRoutes({
    goal: "create compact memory checkpoint",
    candidates: [
      { id: "raw-pwsh", command: "pwsh -File .\\scripts\\write-memory.ps1" },
      {
        id: "memory-wrapper",
        command: "node tools/memory_hook/memory_hook.mjs --mode checkpoint --summary ok",
      },
    ],
  });

  assert.equal(result.winner.id, "memory-wrapper");
  assert.equal(result.winner.scores.task_fit, 2);
});

test("does not let a safe but irrelevant wrapper win only by reward", () => {
  const result = rankRoutes({
    goal: "inspect Docker containers",
    candidates: [
      {
        id: "irrelevant-memory-wrapper",
        command: "node tools/memory_hook/memory_hook.mjs --mode checkpoint --summary ok",
      },
      { id: "docker-mcp", surface: "mcp", command: "theseus_docker docker_ps" },
    ],
  });

  assert.equal(result.winner.id, "docker-mcp");
  assert.ok(result.ranked.find((route) => route.id === "irrelevant-memory-wrapper").scores.task_fit < 0);
});

test("delays final reward until verification succeeds", () => {
  const result = rankRoutes({
    goal: "scan staged secrets before commit",
    candidates: [{ id: "scan", command: "node tools/git_safety/scan_staged.mjs" }],
  });

  const pending = result.winner;
  const verified = applyVerification(pending, { ok: true, note: "scan passed" });
  const failed = applyVerification(pending, { ok: false, note: "scan failed" });

  assert.equal(pending.final_reward.status, "pending");
  assert.equal(verified.final_reward.status, "verified");
  assert.ok(verified.final_reward.score > pending.final_reward.score);
  assert.equal(failed.final_reward.status, "failed");
  assert.ok(failed.final_reward.score < 0);
});

test("ranks minimal skill router above loading all project skills", () => {
  const result = rankRoutes({
    goal: "choose minimal Theseus skill route",
    candidates: [
      { id: "all-skills", command: "load all project skills" },
      { id: "router", command: "use theseus-skill-router then load one matching skill" },
    ],
  });

  assert.equal(result.winner.id, "router");
  assert.ok(result.ranked.find((route) => route.id === "all-skills").scores.task_fit < 0);
  assert.ok(result.ranked.find((route) => route.id === "all-skills").scores.context_cost < 0);
});
