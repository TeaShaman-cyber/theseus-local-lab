import { readdirSync } from "node:fs";
import path from "node:path";

const TEST_SUFFIX = ".test.mjs";
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const EXACT_NODE_VERSION = /^\d+\.\d+\.\d+$/;

/** Return true only when the runtime exactly matches a pinned semver version. */
export function nodeRuntimeMatches(expectedVersion, actualVersion) {
  return (
    typeof expectedVersion === "string" &&
    EXACT_NODE_VERSION.test(expectedVersion) &&
    actualVersion === expectedVersion
  );
}

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
    { id: "race-test", label: "tools/git_safety/test_check_race.py" },
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

/**
 * Machine-readable population: what was examined, what was excluded and why, and
 * proof that the gate itself was alive.
 *
 * A verdict alone is a weaker claim than it looks: `result=success` covered 225 of
 * 227 tests, two suites that cannot run on Linux at all, and a secret scan that
 * skipped because nothing was staged. This record carries all three parts.
 */
export function buildPopulation(results, { tests = null, liveness = {} } = {}) {
  const steps = results.map((result) => {
    const entry = { id: result.id, status: result.status };
    if (result.reason) entry.reason = result.reason;
    if (result.exitCode !== undefined) entry.exit = result.exitCode;
    return entry;
  });

  const ok = steps.filter((step) => step.status === "ok").length;
  const failed = steps.filter((step) => step.status === "fail").length;
  const skipped = steps.filter((step) => step.status === "skip");

  return {
    schema: 1,
    result: failed === 0 && ok > 0 ? "pass" : "fail",
    examined: { steps: steps.length, ok, failed, skipped: skipped.length },
    tests,
    skipped: skipped.map((step) => ({ id: step.id, reason: step.reason ?? "unspecified" })),
    liveness: {
      at: liveness.at ?? new Date().toISOString(),
      node: liveness.node ?? null,
      platform: liveness.platform ?? null,
      pid: liveness.pid ?? null,
    },
    steps,
  };
}

/**
 * Parse node:test summary counts from runner output. Returns null when the
 * runner printed no summary, so an unparsed run is UNKNOWN rather than zero.
 *
 * The prefix differs by reporter and by TTY: older output uses `# tests 227`,
 * Node 24's default reporter prints `ℹ tests 227`. Both are accepted; a parser
 * written for only one of them silently reports "unknown" on the other.
 */
export function parseTestCounts(output) {
  const text = String(output ?? "");
  const pick = (label) => {
    const match = text.match(new RegExp(`^[^\\w\\s]{1,2}\\s*${label}\\s+(\\d+)\\s*$`, "m"));
    return match ? Number(match[1]) : null;
  };

  const tests = pick("tests");
  const pass = pick("pass");
  const fail = pick("fail");
  const skipped = pick("skipped");
  if (tests === null && pass === null && fail === null) return null;
  return { tests, pass, fail, skipped };
}

/**
 * Render the receipt block from a population record.
 *
 * The receipt is a projection: everything in it comes from the record, so it can
 * be rebuilt byte-for-byte from `dev-check-result.json`. If the two ever diverge,
 * the record is the source and the receipt is the rumour.
 */
export function formatPopulationReceipt(population) {
  const { examined, tests, skipped, liveness } = population;
  const lines = [];

  lines.push(`population_steps=${examined.steps} ok=${examined.ok} failed=${examined.failed} skipped=${examined.skipped}`);

  if (tests) {
    lines.push(
      `population_tests=${tests.tests ?? "unknown"} pass=${tests.pass ?? "unknown"} ` +
        `fail=${tests.fail ?? "unknown"} skipped=${tests.skipped ?? "unknown"}`,
    );
  } else {
    lines.push("population_tests=unknown reason=runner-printed-no-summary");
  }

  if (skipped.length === 0) {
    lines.push("population_skipped=none");
  } else {
    for (const step of skipped) {
      lines.push(`population_skipped id=${step.id} reason=${step.reason}`);
    }
  }

  lines.push(
    `population_liveness at=${liveness.at} node=${liveness.node ?? "unknown"} ` +
      `platform=${liveness.platform ?? "unknown"} pid=${liveness.pid ?? "unknown"}`,
  );

  return lines.join("\n");
}
