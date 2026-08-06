import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const guard = path.resolve("tools/github_issue_cards/issue_card_guard.mjs");

async function runGuard(mode, card) {
  const root = await mkdtemp(path.join(os.tmpdir(), "theseus-issue-card-"));
  const file = path.join(root, "card.md");
  await writeFile(file, card, "utf8");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [guard, mode, "--card", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const base = (repositorySource, operation, status = "DRAFT") => `
card_id: TEST-001
status: ${status}
project: "New project"
repository: "TeaShaman-cyber/example"
repository_source: "${repositorySource}"
target_confirmation: "${repositorySource === "user_contract" ? "user_confirmed" : "pending"}"
issue_number: null
operation: "${operation}"
purpose: "guard regression"
`;

test("pending target is valid for read-only discovery", async () => {
  const result = await runGuard("validate", base("pending", "read"));
  assert.equal(result.code, 0);
});

test("pending target cannot be used for a write operation", async () => {
  const result = await runGuard("validate", base("pending", "create"));
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /only permits read-only diagnostics/);
});

test("workspace origin remains valid only as a read-only diagnostic", async () => {
  const result = await runGuard("validate", base("current_workspace_origin", "read"));
  assert.equal(result.code, 0);
});

test("workspace origin cannot become a write target", async () => {
  const result = await runGuard("validate", base("current_workspace_origin", "create"));
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /only permits read-only diagnostics/);
});

test("write gate requires explicit target confirmation", async () => {
  const result = await runGuard("write-guard", base("user_contract", "create", "APPROVED").replace("target_confirmation: \"user_confirmed\"", "target_confirmation: \"pending\""));
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /target_confirmation=user_confirmed/);
});

test("confirmed project target opens the write gate without writing", async () => {
  const card = base("user_contract", "create", "APPROVED").replace("target_confirmation: \"user_confirmed\"", "target_confirmation: \"user_confirmed\"") + `
human_review:
  approval_scope: "create one issue with approved title and body"
`;
  const result = await runGuard("write-guard", card);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /target=TeaShaman-cyber\/example/);
  assert.match(result.stdout, /No GitHub write was executed/);
});
