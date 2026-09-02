import assert from "node:assert/strict";
import test from "node:test";

import { validateBrief } from "./council_preflight.mjs";

const baseBrief = {
  packet_id: "TEST-PACKET-1",
  council_opt_in: true,
  opt_in_basis: "user explicitly requested a council",
  advisory_runtime: "locked_down_process",
  tool_inventory_verified: true,
  task_mode: "implementation_proposal",
  deliverable_type: "concrete technical proposal",
  mutation_scope: "none",
  capabilities: {
    filesystem: "none",
    web: "bounded_read",
    network: "none",
    docker: "none",
    secrets: "forbidden",
    external_writes: "forbidden",
  },
  acceptance_artifact: "target files, patch, tests, and commands",
  promotion_gate: "explicit user approval before real-repo or runtime mutation",
};

test("accepts a read-only implementation proposal brief", () => {
  const result = validateBrief(baseBrief);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("rejects a practical task that is only a review", () => {
  const result = validateBrief({
    ...baseBrief,
    practical_task: true,
    task_mode: "review",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("PRACTICAL_TASK_REQUIRES_IMPLEMENTATION_MODE"));
});

test("requires sandbox scope for sandbox implementation", () => {
  const result = validateBrief({
    ...baseBrief,
    task_mode: "sandbox_implementation",
    mutation_scope: "real_repo",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("SANDBOX_SCOPE_MUST_BE_ISOLATED_WORKSPACE"));
});

test("rejects missing capability and unsafe side-effect grants", () => {
  const result = validateBrief({
    ...baseBrief,
    capabilities: {
      ...baseBrief.capabilities,
      secrets: "available",
      external_writes: "allowed",
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("SECRETS_MUST_BE_FORBIDDEN"));
  assert.ok(result.errors.includes("EXTERNAL_WRITES_MUST_BE_FORBIDDEN"));
});

test("rejects implementation proposal with real-repo mutation", () => {
  const result = validateBrief({
    ...baseBrief,
    mutation_scope: "real_repo",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("PROPOSAL_SCOPE_MUST_NOT_MUTATE_REAL_REPO"));
});

test("requires explicit council opt-in", () => {
  const result = validateBrief({
    ...baseBrief,
    council_opt_in: false,
    opt_in_basis: "",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("COUNCIL_REQUIRES_EXPLICIT_USER_OPT_IN"));
  assert.ok(result.errors.includes("OPT_IN_BASIS_REQUIRED"));
});

test("requires a verified locked-down advisory runtime", () => {
  const result = validateBrief({
    ...baseBrief,
    advisory_runtime: "full_tool_parent",
    tool_inventory_verified: false,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("ADVISORY_RUNTIME_MUST_BE_LOCKED_DOWN"));
  assert.ok(result.errors.includes("TOOL_INVENTORY_MUST_BE_VERIFIED"));
});
