import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const mode = args[0];
const cardFlag = args.indexOf("--card");
const cardPath = cardFlag >= 0 ? args[cardFlag + 1] : "";

function fail(message) {
  console.error(`ISSUE_CARD_BLOCKED: ${message}`);
  process.exit(1);
}

if (!mode || !cardPath || !["prepare", "validate", "readback", "write-guard"].includes(mode)) {
  console.error("Usage: node tools/github_issue_cards/issue_card_guard.mjs <prepare|validate|readback|write-guard> --card <path>");
  process.exit(2);
}

const absolutePath = path.resolve(cardPath);
if (!fs.existsSync(absolutePath)) fail(`card not found: ${cardPath}`);

const text = fs.readFileSync(absolutePath, "utf8");
const value = (key) => {
  const match = text.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
};

const status = value("status");
const operation = value("operation");
const project = value("project");
const repository = value("repository");
const repositorySource = value("repository_source");
const targetConfirmation = value("target_confirmation");
const issueNumber = value("issue_number");
const purpose = value("purpose");
const required = [
  ["project", project],
  ["repository", repository],
  ["repository_source", repositorySource],
  ["target_confirmation", targetConfirmation],
  ["operation", operation],
  ["purpose", purpose],
];

if (mode === "prepare") {
  if (status !== "DRAFT") fail(`prepare requires status DRAFT, got ${status || "missing"}`);
  console.log(`ISSUE_CARD_READY_FOR_REVIEW: ${absolutePath}`);
  console.log(`target=${repository || "missing"} issue=${issueNumber || "new"} operation=${operation || "missing"}`);
  process.exit(0);
}

for (const [key, current] of required) {
  if (!current || current === '""' || current === "null") fail(`required field missing: ${key}`);
}

const allowedOperations = new Set(["read", "create", "edit", "comment", "label", "close"]);
if (!allowedOperations.has(operation)) fail(`unsupported operation: ${operation}`);
const allowedRepositorySources = new Set(["user_contract", "project_card", "read_only_discovery", "pending", "current_workspace_origin"]);
if (!allowedRepositorySources.has(repositorySource)) fail(`invalid repository_source: ${repositorySource}`);

if (mode === "validate") {
  if (!["DRAFT", "READY_FOR_REVIEW", "APPROVED", "EXECUTED", "READ_BACK_VERIFIED", "REWORK", "BLOCKED"].includes(status)) {
    fail(`invalid status: ${status || "missing"}`);
  }
  if (["pending", "current_workspace_origin"].includes(repositorySource) && operation !== "read") fail(`${repositorySource} only permits read-only diagnostics`);
  console.log(`ISSUE_CARD_VALID: ${absolutePath}`);
  console.log(`project=${project} repository=${repository} repository_source=${repositorySource} issue=${issueNumber || "new"} operation=${operation} status=${status}`);
  process.exit(0);
}

if (mode === "readback") {
  if (status !== "EXECUTED" && status !== "READ_BACK_VERIFIED") {
    fail(`readback requires status EXECUTED or READ_BACK_VERIFIED, got ${status || "missing"}`);
  }
  if (!text.match(/^\s*observed:\s*[^\s].*$/m)) fail("readback.observed is empty");
  if (!text.match(/^\s*verified_at:\s*[^\s].*$/m)) fail("readback.verified_at is empty");
  console.log(`ISSUE_CARD_READBACK_FIELDS_PRESENT: ${absolutePath}`);
  process.exit(0);
}

if (mode === "write-guard") {
  if (status !== "APPROVED") fail(`external write requires status APPROVED, got ${status || "missing"}`);
  if (targetConfirmation !== "user_confirmed") fail(`external write requires target_confirmation=user_confirmed, got ${targetConfirmation || "missing"}`);
  if (["pending", "read_only_discovery", "current_workspace_origin"].includes(repositorySource)) fail(`external write requires confirmed repository_source, got ${repositorySource}`);
  if (!text.match(/^\s*approval_scope:\s*[^\s].*$/m)) fail("human_review.approval_scope is empty");
  console.log("ISSUE_WRITE_GATE_OPEN: card has explicit APPROVED status and scope");
  console.log(`target=${repository} source=${repositorySource} target_confirmation=${targetConfirmation} operation=${operation}`);
  console.log("No GitHub write was executed by this generic guard task.");
  console.log("The agent must still issue exactly one approved operation through the project GitHub route and then perform read-back.");
}
