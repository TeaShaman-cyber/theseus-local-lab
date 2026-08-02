import test from "node:test";
import assert from "node:assert/strict";
import { validateRequest, validateResult } from "./contract.mjs";

test("accepts an explicit read-only probe request", () => {
  const result = validateRequest({ backend: "wsl", task: "probe", timeout_ms: 5000 });
  assert.equal(result.ok, true);
  assert.equal(result.request.mode, "read-only");
});

test("accepts a bounded codex-do request with explicit host and user", () => {
  const result = validateRequest({
    backend: "codex-do",
    task: "probe",
    host: "138.68.66.30",
    user: "root",
  });
  assert.equal(result.ok, true);
  assert.equal(result.request.host, "138.68.66.30");
  assert.equal(result.request.user, "root");
});

test("rejects unknown backends and scoped writes in phase one", () => {
  assert.equal(validateRequest({ backend: "freebsd", task: "probe" }).ok, false);
  assert.equal(validateRequest({ backend: "wsl", task: "probe", mode: "scoped-write" }).ok, false);
});

test("rejects unbounded or unknown tasks", () => {
  assert.equal(validateRequest({ backend: "wsl", task: "probe", timeout_ms: 0 }).ok, false);
  assert.equal(validateRequest({ backend: "wsl", task: "run-anything" }).ok, false);
});

test("requires a postcondition on results", () => {
  const result = validateResult({ backend: "wsl", status: "OK", elapsed_ms: 10, exit_code: 0 });
  assert.equal(result.ok, false);
});
