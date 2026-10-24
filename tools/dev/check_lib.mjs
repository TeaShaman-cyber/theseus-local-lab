import { readdirSync } from "node:fs";
import path from "node:path";

const TEST_SUFFIX = ".test.mjs";
const SKIP_DIRS = new Set(["node_modules", ".git"]);

/** Build stable Node test-runner arguments; serial execution avoids timer races. */
export function buildTestArgs(testFiles) {
  return ["--test", "--test-concurrency=1", ...testFiles];
}

/**
 * Recursively collect node:test suites under tools/.
 * Returns repo-relative POSIX paths, sorted for stable output.
 */
export function collectTestFiles(repoRoot) {
  const found = [];

  function walk(relativeDir) {
    const absoluteDir = path.join(repoRoot, relativeDir);
    const entries = readdirSync(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.posix.join(relativeDir, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(TEST_SUFFIX)) {
        found.push(path.posix.join(relativeDir, entry.name));
      }
    }
  }

  walk("tools");
  return found.sort();
}

/**
 * Ordered QA steps. The secret scan only makes sense when something is staged,
 * so it is omitted entirely rather than silently passing.
 */
export function buildSteps({ hasStagedFiles } = {}) {
  const steps = [
    { id: "unit", label: "node --test --test-concurrency=1 tools/**/*.test.mjs" },
    { id: "contract", label: "tools/contract_checks/agentops_gitops_contract.mjs" },
    { id: "redaction", label: "tools/dev/redaction_check.mjs" },
    { id: "diff-check", label: "git diff --check" },
  ];

  if (hasStagedFiles) {
    steps.push({ id: "secret-scan", label: "tools/git_safety/scan_staged.mjs" });
  }

  return steps;
}

/**
 * One-line verdict. Names the first failing step, never the last, so the
 * reported cause matches the point where the run actually broke.
 */
export function formatVerdict(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "DEV_CHECK_FAIL step=setup reason=no-steps";
  }

  const invalid = results.find((result) => !["ok", "fail", "skip"].includes(result.status));
  if (invalid) return `DEV_CHECK_FAIL step=${invalid.id || "setup"} reason=invalid-status`;

  const failure = results.find((result) => result.status === "fail");
  if (failure) {
    const exit = failure.exitCode === undefined ? "" : ` exit=${failure.exitCode}`;
    return `DEV_CHECK_FAIL step=${failure.id}${exit}`;
  }

  if (!results.some((result) => result.status === "ok")) {
    return "DEV_CHECK_FAIL step=setup reason=no-successful-steps";
  }

  return "DEV_CHECK_PASS";
}
