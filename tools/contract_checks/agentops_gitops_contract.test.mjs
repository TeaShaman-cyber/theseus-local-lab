import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { inspectContract } from "./agentops_gitops_contract.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("active harness contract is executable and current", () => {
  const report = inspectContract(repoRoot);

  assert.equal(report.status, "OK", JSON.stringify(report, null, 2));
  assert.deepEqual(report.violations, []);
});
