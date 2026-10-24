import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildSteps, buildTestArgs, collectTestFiles, formatVerdict } from "./check_lib.mjs";

test("collects node test files recursively, sorts them, and ignores node_modules", () => {
  const root = mkdtempSync(path.join(tmpdir(), "devcheck-"));
  mkdirSync(path.join(root, "tools", "alpha"), { recursive: true });
  mkdirSync(path.join(root, "tools", "beta", "nested"), { recursive: true });
  mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
  writeFileSync(path.join(root, "tools", "beta", "nested", "beta.test.mjs"), "");
  writeFileSync(path.join(root, "tools", "alpha", "alpha.test.mjs"), "");
  writeFileSync(path.join(root, "node_modules", "pkg", "pkg.test.mjs"), "");

  assert.deepEqual(collectTestFiles(root), [
    "tools/alpha/alpha.test.mjs",
    "tools/beta/nested/beta.test.mjs",
  ]);
});

test("uses serial Node test concurrency to avoid timer races between suites", () => {
  assert.deepEqual(buildTestArgs(["tools/a.test.mjs", "tools/b.test.mjs"]), [
    "--test",
    "--test-concurrency=1",
    "tools/a.test.mjs",
    "tools/b.test.mjs",
  ]);
});

test("fails closed when the repository has no tools directory", () => {
  const root = mkdtempSync(path.join(tmpdir(), "devcheck-empty-"));
  assert.throws(() => collectTestFiles(root), { code: "ENOENT" });
});

test("redaction check always runs and secret scan runs only when files are staged", () => {
  const withStaged = buildSteps({ hasStagedFiles: true }).map((step) => step.id);
  const withoutStaged = buildSteps({ hasStagedFiles: false }).map((step) => step.id);

  assert.ok(withStaged.includes("redaction"));
  assert.ok(withoutStaged.includes("redaction"));
  assert.ok(withStaged.includes("secret-scan"));
  assert.ok(!withoutStaged.includes("secret-scan"));
  assert.ok(withoutStaged.includes("unit"));
  assert.ok(withoutStaged.includes("contract"));
  assert.ok(withoutStaged.includes("diff-check"));
});

test("verdict passes only when every executed step succeeded", () => {
  assert.equal(
    formatVerdict([
      { id: "unit", status: "ok" },
      { id: "contract", status: "ok" },
    ]),
    "DEV_CHECK_PASS",
  );

  assert.match(
    formatVerdict([
      { id: "unit", status: "ok" },
      { id: "contract", status: "fail", exitCode: 2 },
    ]),
    /^DEV_CHECK_FAIL step=contract exit=2/,
  );
});

test("a skipped step is reported without failing the gate", () => {
  const verdict = formatVerdict([
    { id: "unit", status: "ok" },
    { id: "secret-scan", status: "skip", reason: "no staged files" },
  ]);

  assert.equal(verdict, "DEV_CHECK_PASS");
});

test("the first failing step is named, not the last", () => {
  const verdict = formatVerdict([
    { id: "unit", status: "fail", exitCode: 1 },
    { id: "contract", status: "fail", exitCode: 3 },
  ]);

  assert.match(verdict, /step=unit/);
});

test("an empty run cannot produce a passing verdict", () => {
  assert.equal(formatVerdict([]), "DEV_CHECK_FAIL step=setup reason=no-steps");
});

test("a run with no successful checks cannot produce a passing verdict", () => {
  assert.equal(
    formatVerdict([
      { id: "unit", status: "skip", reason: "no test files" },
      { id: "contract", status: "skip", reason: "not run" },
    ]),
    "DEV_CHECK_FAIL step=setup reason=no-successful-steps",
  );
});
