import test from "node:test";
import assert from "node:assert/strict";
import { loadCases, validateCases, validateRepositoryCases } from "./representative_cases_contract.mjs";

test("representative route cases are a valid bounded contract", () => {
  const result = validateRepositoryCases();
  assert.equal(result.valid, true);
  assert.equal(result.cases, 6);
});

test("case IDs are unique and every case has an observable stop", () => {
  const document = loadCases();
  const result = validateCases(document);
  assert.deepEqual(result.ids, [
    "no-skill-trivial-chat",
    "memory-continuity-request",
    "local-shell-task",
    "fresh-external-research",
    "repeated-equivalent-failure",
    "phase-transition",
  ]);
  for (const item of document.cases) assert.match(item.expected.stop, /\S/);
});

test("unknown skills cannot enter the route contract", () => {
  const document = loadCases();
  document.cases[0].expected.skills = ["invented-skill"];
  assert.throws(() => validateCases(document), /unknown active skill/);
});

test("duplicate cases cannot enter the route contract", () => {
  const document = loadCases();
  document.cases.push({ ...document.cases[0] });
  assert.throws(() => validateCases(document), /duplicate case id/);
});
