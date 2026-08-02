import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases, validateCases } from "./representative_cases_contract.mjs";

const toolRoot = path.dirname(fileURLToPath(import.meta.url));

export function buildNoSkillReceipt(caseId = "no-skill-trivial-chat") {
  const document = loadCases();
  validateCases(document);
  const item = document.cases.find((candidate) => candidate.id === caseId);
  if (!item) throw new Error(`unknown route case: ${caseId}`);
  if (item.expected.route !== "no-skill") throw new Error(`case is not a no-skill case: ${caseId}`);

  return {
    schema_version: 1,
    type: "route-receipt",
    case_id: item.id,
    route: "no-skill",
    selected_skills: [],
    executor: "none",
    status: "completed",
    verification: "response delivered",
    stop: "after response",
    evidence: "bounded no-skill contract receipt",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const caseId = process.argv[2] || "no-skill-trivial-chat";
  console.log(JSON.stringify(buildNoSkillReceipt(caseId), null, 2));
}
