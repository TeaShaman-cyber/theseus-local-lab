import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { inspectContract } from "./agentops_gitops_contract.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("AgentOps/GitOps v1 contract is executable and current", () => {
  const report = inspectContract(repoRoot);

  assert.equal(report.status, "OK", JSON.stringify(report, null, 2));
  assert.deepEqual(report.hook_events, ["PostCompact", "PreCompact", "Stop", "UserPromptSubmit"]);
  assert.ok(report.recovery_stack_count >= 1);
  assert.ok(report.required_files.every((item) => item.status === "OK"));
  assert.ok(report.removed_legacy.every((item) => item.status === "ABSENT"));
  assert.ok(report.active_legacy_references.every((item) => item.status === "ABSENT"));
});
