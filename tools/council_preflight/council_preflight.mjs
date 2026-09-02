#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TASK_MODES = new Set([
  "review",
  "implementation_proposal",
  "sandbox_implementation",
  "verification",
]);

const MUTATION_SCOPES = new Set([
  "none",
  "isolated_workspace",
  "real_repo",
  "external_system",
]);

const CAPABILITY_VALUES = {
  filesystem: new Set(["none", "isolated_worktree"]),
  web: new Set(["none", "bounded_read"]),
  network: new Set(["none", "internal_only", "allowlist"]),
  docker: new Set(["none", "ephemeral_compose_wrapper"]),
};

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateBrief(brief) {
  const errors = [];
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) {
    return { ok: false, errors: ["BRIEF_MUST_BE_OBJECT"] };
  }

  if (brief.council_opt_in !== true) errors.push("COUNCIL_REQUIRES_EXPLICIT_USER_OPT_IN");
  if (!nonEmpty(brief.opt_in_basis)) errors.push("OPT_IN_BASIS_REQUIRED");
  if (brief.advisory_runtime !== "locked_down_process") {
    errors.push("ADVISORY_RUNTIME_MUST_BE_LOCKED_DOWN");
  }
  if (brief.tool_inventory_verified !== true) errors.push("TOOL_INVENTORY_MUST_BE_VERIFIED");
  if (!nonEmpty(brief.packet_id)) errors.push("PACKET_ID_REQUIRED");
  if (!TASK_MODES.has(brief.task_mode)) errors.push("TASK_MODE_INVALID");
  if (!nonEmpty(brief.deliverable_type)) errors.push("DELIVERABLE_TYPE_REQUIRED");
  if (!MUTATION_SCOPES.has(brief.mutation_scope)) errors.push("MUTATION_SCOPE_INVALID");
  if (!nonEmpty(brief.acceptance_artifact)) errors.push("ACCEPTANCE_ARTIFACT_REQUIRED");
  if (!nonEmpty(brief.promotion_gate) || !/user\s+approval/i.test(brief.promotion_gate)) {
    errors.push("PROMOTION_GATE_REQUIRES_USER_APPROVAL");
  }

  const capabilities = brief.capabilities;
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    errors.push("CAPABILITIES_REQUIRED");
  } else {
    for (const [name, allowed] of Object.entries(CAPABILITY_VALUES)) {
      if (!allowed.has(capabilities[name])) errors.push(`CAPABILITY_${name.toUpperCase()}_INVALID`);
    }
    if (capabilities.secrets !== "forbidden") errors.push("SECRETS_MUST_BE_FORBIDDEN");
    if (capabilities.external_writes !== "forbidden") errors.push("EXTERNAL_WRITES_MUST_BE_FORBIDDEN");
  }

  if (brief.practical_task === true && brief.task_mode === "review") {
    errors.push("PRACTICAL_TASK_REQUIRES_IMPLEMENTATION_MODE");
  }
  if (brief.task_mode === "implementation_proposal" &&
      !["none", "isolated_workspace"].includes(brief.mutation_scope)) {
    errors.push("PROPOSAL_SCOPE_MUST_NOT_MUTATE_REAL_REPO");
  }
  if (brief.task_mode === "sandbox_implementation" &&
      brief.mutation_scope !== "isolated_workspace") {
    errors.push("SANDBOX_SCOPE_MUST_BE_ISOLATED_WORKSPACE");
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const inputIndex = process.argv.indexOf("--input");
  if (inputIndex < 0 || !process.argv[inputIndex + 1]) {
    console.error("Usage: node tools/council_preflight/council_preflight.mjs --input <brief.json>");
    process.exit(1);
  }

  let brief;
  try {
    brief = JSON.parse(readFileSync(process.argv[inputIndex + 1], "utf8"));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, errors: ["BRIEF_JSON_INVALID"], detail: error.message }));
    process.exit(2);
  }

  const result = validateBrief(brief);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
