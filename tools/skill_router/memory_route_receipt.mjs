import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases, validateCases } from "./representative_cases_contract.mjs";

export function buildMemoryReceipt({
  caseId = "memory-continuity-request",
  memoryId,
  result = "recall receipt",
} = {}) {
  const document = loadCases();
  validateCases(document);
  const item = document.cases.find((candidate) => candidate.id === caseId);
  if (!item) throw new Error(`unknown route case: ${caseId}`);
  if (!item.expected.skills?.includes("theseus-memory-stack")) {
    throw new Error(`case is not a memory route case: ${caseId}`);
  }
  if (!memoryId) throw new Error("memoryId is required for a verified memory receipt");

  return {
    schema_version: 1,
    type: "route-receipt",
    case_id: item.id,
    route: "memory-continuity",
    selected_skills: ["theseus-memory-stack"],
    executor: "AutoMem recall",
    status: "completed",
    verification: result,
    memory_id: memoryId,
    stop: "do not promote memory to current runtime fact",
    evidence: "bounded read-only memory route receipt",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const memoryId = args[0];
  const verificationIndex = args.indexOf("--verification");
  const result = verificationIndex >= 0 ? args.slice(verificationIndex + 1).join(" ") : "recall receipt";
  console.log(JSON.stringify(buildMemoryReceipt({ memoryId, result }), null, 2));
}
