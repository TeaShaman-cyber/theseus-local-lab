import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { extractHandle, isSuccessfulReport, peopleCount } from "./gramps_mcp_http_crud_contract.mjs";

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

test("defines a manual Gramps MCP HTTP endpoint probe", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const task = config.tasks.find((item) => item.label === "Family Research: Gramps MCP HTTP endpoint probe");

  assert.ok(task, "Family Research Gramps MCP HTTP endpoint probe is missing");
  assert.equal(task.type, "process");
  assert.equal(task.command, "node");
  assert.ok(task.args.includes("tools/unix_runtime/gramps_mcp_http_probe.mjs"));
  assert.ok(task.args.includes("${input:familyResearchHttpsEndpoint}"));
  assert.ok(task.args.includes("/mcp"));
  assert.equal(task.runOptions?.runOn, undefined);
});

test("defines a manual Gramps MCP HTTP profile apply task", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const task = config.tasks.find((item) => item.label === "Family Research: apply Gramps MCP HTTP profile");

  assert.ok(task, "Family Research Gramps MCP HTTP profile apply task is missing");
  assert.equal(task.type, "process");
  assert.equal(task.command, "node");
  assert.ok(task.args.includes("tools/unix_runtime/gramps_mcp_http_apply.mjs"));
  assert.ok(task.args.includes("--apply"));
  assert.equal(task.runOptions?.runOn, undefined);
});

test("documents a Caddy backup and rollback gate in the apply plan", async () => {
  const { buildPlan } = await import("./gramps_mcp_http_apply.mjs");
  const plan = buildPlan("138.68.66.30", "root");
  assert.equal(plan.rollback.caddy_backup, "/etc/caddy/Caddyfile.family-research.previous");
  assert.ok(plan.steps.some((step) => /restore the previous Caddyfile/i.test(step)));
});

test("keeps the Gramps MCP image pinned in the deploy profile", () => {
  const compose = readFileSync(`${repoRoot}/deploy/gramps-mcp/docker-compose.yml`, "utf8");
  assert.match(compose, /image:\s+ghcr\.io\/scormave\/gramps-web-mcp@sha256:[0-9a-f]{64}/);
  assert.doesNotMatch(compose, /gramps-web-mcp:latest/);
});

test("defines a manual Gramps MCP HTTP protocol probe", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const task = config.tasks.find((item) => item.label === "Family Research: Gramps MCP HTTP protocol probe");

  assert.ok(task, "Family Research Gramps MCP HTTP protocol probe is missing");
  assert.equal(task.type, "process");
  assert.equal(task.command, "node");
  assert.ok(task.args.includes("tools/unix_runtime/gramps_mcp_http_protocol_probe.mjs"));
  assert.ok(task.args.includes("${input:familyResearchHttpsEndpoint}/mcp"));
  assert.equal(task.runOptions?.runOn, undefined);
});

test("defines a manual Gramps MCP CRUD smoke test", () => {
  const config = JSON.parse(readFileSync(tasksPath, "utf8"));
  const task = config.tasks.find((item) => item.label === "Family Research: Gramps MCP CRUD smoke test");

  assert.ok(task, "Family Research Gramps MCP CRUD smoke test is missing");
  assert.equal(task.type, "process");
  assert.equal(task.command, "node");
  assert.ok(task.args.includes("tools/unix_runtime/gramps_mcp_http_crud_direct.mjs"));
  assert.ok(task.args.includes("${input:familyResearchHttpsEndpoint}/mcp"));
  assert.equal(task.runOptions?.runOn, undefined);
});

test("parses opaque Gramps handles without accepting short identifiers", () => {
  assert.equal(extractHandle({ result: { content: [{ type: "text", text: "created handle 0123456789abcdef0123" }] } }), "0123456789abcdef0123");
  assert.equal(extractHandle({ result: { content: [{ type: "text", text: "created handle abc123" }] } }), null);
});

test("keeps the empty-tree count deterministic", () => {
  assert.equal(peopleCount({ result: { content: [{ type: "text", text: "No people found" }] } }), 0);
  assert.equal(peopleCount({ result: { content: [{ type: "text", text: "People: 2" }] } }), 2);
  assert.equal(peopleCount({ result: { content: [{ type: "text", text: "unexpected response" }] } }), null);
});

test("rejects a report that needed failure cleanup", () => {
  const report = {
    initial_people_count: 0, precondition: "passed", create: "passed", read: "passed",
    update: "passed", delete: "passed", cleanup_status: "not_needed",
    final_people_count: 0, synthetic_record_remains: false,
  };
  assert.equal(isSuccessfulReport(report), true);
  assert.equal(isSuccessfulReport({ ...report, cleanup_status: "passed" }), false);
  assert.equal(isSuccessfulReport({ ...report, synthetic_record_remains: true }), false);
});
