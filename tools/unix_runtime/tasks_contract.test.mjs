import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const tasksPath = `${repoRoot}/.vscode/tasks.json`;

test("defines a manual Unix runtime probe task without startup execution", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const task = config.tasks.find((item) => item.label === "Theseus Unix Runtime: probe backend");

  assert.ok(task, "Unix runtime probe task is missing");
  assert.equal(task.type, "process");
  assert.equal(task.command, "node");
  assert.ok(task.args.includes("tools/unix_runtime/unix_runtime.mjs"));
  assert.ok(task.args.includes("probe"));
  assert.ok(task.args.includes("${input:unixRuntimeBackend}"));
  assert.equal(task.runOptions?.runOn, undefined);
});

test("defines the backend input as a closed set", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const input = config.inputs.find((item) => item.id === "unixRuntimeBackend");

  assert.deepEqual(input, {
    id: "unixRuntimeBackend",
    type: "pickString",
    description: "Unix runtime backend to probe",
    options: ["wsl", "docker", "ubuntu-vm"],
    default: "wsl",
  });
});

test("defines a separate Family Research codex-do task", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const task = config.tasks.find((item) => item.label === "Family Research: codex-do read-only probe");

  assert.ok(task, "Family Research codex-do task is missing");
  assert.equal(task.type, "process");
  assert.equal(task.command, "node");
  assert.ok(task.args.includes("--backend"));
  assert.ok(task.args.includes("codex-do"));
  assert.ok(task.args.includes("${input:codexDoHost}"));
  assert.ok(task.args.includes("${input:codexDoUser}"));
  assert.equal(task.runOptions?.runOn, undefined);
});

test("defines separate Family Research HTTPS, container, and Caddy tasks", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  for (const label of [
    "Family Research: HTTPS/Caddy endpoint health",
    "Family Research: API surface/auth boundary",
    "Family Research: remote container status",
    "Family Research: Caddy/listener status",
  ]) {
    const task = config.tasks.find((item) => item.label === label);
    assert.ok(task, `${label} is missing`);
    assert.equal(task.type, "process");
    assert.equal(task.command, "node");
  }
});
