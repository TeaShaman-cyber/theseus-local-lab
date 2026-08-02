import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolRoot, "../..");
const casesPath = path.join(repoRoot, "docs/audits/router_representative_cases.json");

export const ACTIVE_SKILLS = new Set([
  "execution-guard",
  "imported-memory-gate",
  "local-agent-hygiene",
  "research-routing",
  "theseus-copilot-advisor",
  "theseus-git-hygiene",
  "theseus-memory-stack",
  "theseus-plugin-conclave",
  "theseus-shell-routing",
  "theseus-skill-router",
]);

export function loadCases() {
  return JSON.parse(readFileSync(casesPath, "utf8"));
}

function assertText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function validateCases(document) {
  if (document?.schema_version !== 1) throw new Error("unsupported case schema");
  if (!Array.isArray(document.cases) || document.cases.length === 0) throw new Error("cases must be non-empty");

  const ids = new Set();
  for (const item of document.cases) {
    assertText(item.id, "case id");
    if (ids.has(item.id)) throw new Error(`duplicate case id: ${item.id}`);
    ids.add(item.id);
    assertText(item.input_class, `${item.id}.input_class`);
    const expected = item.expected || {};
    assertText(expected.executor, `${item.id}.expected.executor`);
    assertText(expected.verification, `${item.id}.expected.verification`);
    assertText(expected.stop, `${item.id}.expected.stop`);
    if (expected.route) assertText(expected.route, `${item.id}.expected.route`);
    if (expected.skills) {
      if (!Array.isArray(expected.skills) || expected.skills.length === 0) throw new Error(`${item.id}.expected.skills must be non-empty`);
      for (const skill of expected.skills) {
        if (!ACTIVE_SKILLS.has(skill)) throw new Error(`${item.id} references unknown active skill: ${skill}`);
      }
    }
  }
  return { valid: true, cases: document.cases.length, ids: [...ids] };
}

export function validateRepositoryCases() {
  return validateCases(loadCases());
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log(JSON.stringify(validateRepositoryCases(), null, 2));
}
