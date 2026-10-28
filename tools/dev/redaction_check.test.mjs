import test from "node:test";
import assert from "node:assert/strict";

import {
  findRedactionFindings,
  parseAddedLines,
  resolvePullRequestBaseSha,
} from "./redaction_check_lib.mjs";

test("parses only added diff lines and tracks new-file line numbers", () => {
  const diff = [
    "diff --git a/config.yml b/config.yml",
    "--- a/config.yml",
    "+++ b/config.yml",
    "@@ -5,2 +5,3 @@",
    " context: kept",
    "-old: removed",
    "+new: added",
    "+second: added",
  ].join("\n");

  assert.deepEqual(parseAddedLines(diff), [
    { path: "config.yml", line: 6, content: "new: added" },
    { path: "config.yml", line: 7, content: "second: added" },
  ]);
});

test("flags raw authorization values without returning their contents", () => {
  const value = ["short", "credential", "value"].join("-");
  const findings = findRedactionFindings([
    {
      path: "workflow.yml",
      line: 12,
      content: ["Authorization:", "Bearer", value].join(" "),
    },
  ]);

  assert.deepEqual(findings, [
    { path: "workflow.yml", line: 12, rule: "raw-authorization-header" },
  ]);
  assert.ok(!JSON.stringify(findings).includes(value));
});

test("flags provider keys and sensitive assignments", () => {
  const providerKey = ["sk", "live", "A".repeat(32)].join("-");
  const databasePasswordLine = ["DATABASE_PASSWORD", "not-for-logs"].join("=");
  const findings = findRedactionFindings([
    { path: "config.env", line: 3, content: `OPENAI_API_KEY=${providerKey}` },
    { path: "config.env", line: 4, content: databasePasswordLine },
  ]);

  assert.deepEqual(findings, [
    { path: "config.env", line: 3, rule: "provider-key" },
    { path: "config.env", line: 4, rule: "sensitive-assignment" },
  ]);
  assert.ok(!JSON.stringify(findings).includes(providerKey));
});

test("ignores explicit placeholders and environment references", () => {
  const findings = findRedactionFindings([
    { path: "workflow.yml", line: 1, content: "OPENAI_API_KEY=${OPENAI_API_KEY}" },
    { path: "workflow.yml", line: 2, content: "Authorization: Bearer <redacted>" },
    { path: "workflow.yml", line: 3, content: "TOKEN=YOUR_TOKEN_HERE" },
  ]);

  assert.deepEqual(findings, []);
});

test("extracts a valid pull-request base SHA and rejects malformed values", () => {
  const baseSha = "a".repeat(40);

  assert.equal(
    resolvePullRequestBaseSha({ pull_request: { base: { sha: baseSha } } }),
    baseSha,
  );
  assert.equal(resolvePullRequestBaseSha({ pull_request: { base: { sha: "bad" } } }), null);
  assert.equal(resolvePullRequestBaseSha({ workflow_dispatch: {} }), null);
});
