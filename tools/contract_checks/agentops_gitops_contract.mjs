#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/reference/agentops-gitops-contract-v1.md",
  "docs/reference/infrastructure-registry.yaml",
  "docs/reference/workspace-registry.yaml",
  "hooks/codex-hooks.json",
  "tools/workshop_recovery/recovery_contract.json",
  "tools/tool_policy/tool_policy.mjs",
  "tools/session_timeline/timeline.mjs",
  "tools/git_safety/scan_staged.mjs",
];

const REMOVED_LEGACY = [
  "tools/codex_thread_relink/README.md",
  "tools/codex_thread_relink/relink_thread_workspace.mjs",
  "tools/codex_thread_relink/relink_thread_workspace.test.mjs",
  "outputs/lab_journals/wsl_migration_conclave_2026-07-18.docx",
  "outputs/wsl_migration_preflight/latest.json",
  ".agents/skills/theseus-copilot-advisor/SKILL.md",
  "tools/copilot_advisor/README.md",
  "tools/copilot_advisor/copilot_advisor.mjs",
  "tools/copilot_advisor/copilot_advisor.test.mjs",
];

const EXPECTED_HOOK_EVENTS = ["PostCompact", "PreCompact", "Stop", "UserPromptSubmit"];

const ACTIVE_LEGACY_REFERENCES = [
  { path: ".vscode/tasks.json", needles: ["tools/copilot_advisor", "ask Copilot advisor", "COPILOT_ADVISOR"] },
  { path: "AGENTS.md", needles: ["theseus-copilot-advisor", "tools/copilot_advisor"] },
  { path: "GIT_META_SKILL.md", needles: ["ask Copilot advisor", "Copilot:"] },
  { path: "skills/theseus-git-hygiene/SKILL.md", needles: ["ask Copilot advisor", "Copilot:"] },
  { path: "tools/skill_observatory/skill_observatory.mjs", needles: ["theseus-copilot-advisor"] },
  { path: "tools/skill_router/representative_cases_contract.mjs", needles: ["theseus-copilot-advisor"] },
  { path: "tools/plugin_conclave/catalog.json", needles: ["copilot-advisor", "tools/copilot_advisor"] },
  { path: "gtd/gtd.toml", needles: ["copilot-advisor", "COPILOT_ADVISOR"] },
  { path: "docs/plans/documentation_audit.md", needles: ["theseus-copilot-advisor", "tools/copilot_advisor"] },
];

function readJson(repoRoot, relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function scanLegacyReferences(repoRoot) {
  return ACTIVE_LEGACY_REFERENCES.map(({ path: relativePath, needles }) => {
    let text = "";
    try {
      text = readFileSync(path.join(repoRoot, relativePath), "utf8");
    } catch {
      return { path: relativePath, status: "ABSENT" };
    }
    const matches = needles.filter((needle) => text.includes(needle));
    return { path: relativePath, status: matches.length ? "PRESENT" : "ABSENT" };
  });
}

function inspectContract(repoRoot = path.resolve(import.meta.dirname, "..", "..")) {
  const requiredFiles = REQUIRED_FILES.map((relativePath) => ({
    path: relativePath,
    status: existsSync(path.join(repoRoot, relativePath)) ? "OK" : "MISSING",
  }));
  const removedLegacy = REMOVED_LEGACY.map((relativePath) => ({
    path: relativePath,
    status: existsSync(path.join(repoRoot, relativePath)) ? "PRESENT" : "ABSENT",
  }));

  const hooks = readJson(repoRoot, "hooks/codex-hooks.json");
  const hookEvents = hooks?.hooks && typeof hooks.hooks === "object" ? Object.keys(hooks.hooks).sort() : [];
  const recovery = readJson(repoRoot, "tools/workshop_recovery/recovery_contract.json");
  const recoveryStackIds = Array.isArray(recovery?.stacks)
    ? recovery.stacks.map((stack) => stack?.id).filter((id) => typeof id === "string").sort()
    : [];
  const recoveryIdsUnique = new Set(recoveryStackIds).size === recoveryStackIds.length;
  const activeLegacyReferences = scanLegacyReferences(repoRoot);

  const status =
    requiredFiles.every((item) => item.status === "OK") &&
    removedLegacy.every((item) => item.status === "ABSENT") &&
    activeLegacyReferences.every((item) => item.status === "ABSENT") &&
    JSON.stringify(hookEvents) === JSON.stringify(EXPECTED_HOOK_EVENTS) &&
    recoveryStackIds.length > 0 &&
    recoveryIdsUnique
      ? "OK"
      : "FAIL";

  return {
    contract: "AgentOps/GitOps v1",
    status,
    hook_events: hookEvents,
    recovery_stack_count: recoveryStackIds.length,
    recovery_stack_ids: recoveryStackIds,
    required_files: requiredFiles,
    removed_legacy: removedLegacy,
    active_legacy_references: activeLegacyReferences,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = inspectContract();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(report.status === "OK" ? "CONTRACT_OK" : "CONTRACT_FAIL");
  if (report.status !== "OK") process.exitCode = 1;
}

export { inspectContract };
