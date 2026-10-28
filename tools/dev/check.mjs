import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPopulation,
  buildSteps,
  buildTestArgs,
  collectTestFiles,
  formatPopulationReceipt,
  formatVerdict,
  nodeRuntimeMatches,
  parseTestCounts,
} from "./check_lib.mjs";
import { resolvePullRequestBaseSha } from "./redaction_check_lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(args) {
  let baseSha = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--help") return { help: true, baseSha: null };
    if (args[index] === "--base" && args[index + 1]) {
      baseSha = args[index + 1];
      index += 1;
    } else {
      throw new Error("unsupported argument");
    }
  }
  if (baseSha && !resolvePullRequestBaseSha({ pull_request: { base: { sha: baseSha } } })) {
    throw new Error("base must be a 40-character Git SHA");
  }
  return { help: false, baseSha };
}

function eventBaseSha() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  try {
    return resolvePullRequestBaseSha(JSON.parse(readFileSync(eventPath, "utf8")));
  } catch {
    throw new Error("unable to read GitHub event metadata");
  }
}

function hasStagedFiles() {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true,
  });
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error("unable to inspect Git index");
  }
  return result.status === 1;
}

function runStep(id, command, args, { capture = false } = {}) {
  console.log(`STEP_START id=${id}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: capture ? "utf8" : undefined,
    windowsHide: true,
  });

  let output = "";
  if (capture) {
    // Echo the captured streams so the human-facing log stays identical to the
    // inherited case; only the bookkeeping differs.
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  }

  if (result.error) {
    console.error(`STEP_FAIL id=${id} reason=command-unavailable`);
    return { id, status: "fail", exitCode: 127, output };
  }
  if (result.status === 0) {
    console.log(`STEP_OK id=${id}`);
    return { id, status: "ok", output };
  }

  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  console.error(`STEP_FAIL id=${id} exit=${exitCode}`);
  return { id, status: "fail", exitCode, output };
}

/**
 * Persist the population record and its receipt projection.
 *
 * Both paths are overridable so tests can write into a temporary directory. Any
 * failure is reported and swallowed: the witness must not be able to fail the gate.
 */
function publishPopulation(population) {
  const resultPath = process.env.DEV_CHECK_RESULT || path.join(repoRoot, "dev-check-result.json");
  const receiptPath = process.env.DEV_CHECK_RECEIPT || path.join(repoRoot, "dev-check-receipt.txt");
  try {
    writeFileSync(resultPath, `${JSON.stringify(population, null, 2)}\n`, "utf8");
    writeFileSync(receiptPath, `${formatPopulationReceipt(population)}\n`, "utf8");
  } catch (error) {
    console.error(`STEP_WARN id=population reason=write-failed detail=${error?.code ?? "unknown"}`);
  }
}

function main(args) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log("Usage: bash tools/dev/check [--base <pull-request-base-sha>]");
    return 0;
  }

  const expectedNodeVersion = readFileSync(path.join(repoRoot, ".nvmrc"), "utf8").trim();
  if (!nodeRuntimeMatches(expectedNodeVersion, process.versions.node)) {
    console.error(
      `DEV_CHECK_FAIL step=runtime expected=v${expectedNodeVersion} actual=${process.version}`,
    );
    return 2;
  }
  console.log(`QA_RUNTIME node=${process.version}`);

  const baseSha = parsed.baseSha ?? eventBaseSha();
  if (
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_EVENT_NAME === "pull_request" &&
    !baseSha
  ) {
    throw new Error("pull-request base SHA is unavailable");
  }

  const staged = hasStagedFiles();
  const steps = buildSteps({ hasStagedFiles: staged });
  const results = [];
  let testFiles = null;
  let testCounts = null;

  try {
    testFiles = collectTestFiles(repoRoot);
  } catch {
    results.push({ id: "unit", status: "fail", exitCode: 1 });
    console.error("STEP_FAIL id=unit reason=test-discovery-failed");
  }

  if (testFiles && testFiles.length === 0) {
    results.push({ id: "unit", status: "fail", exitCode: 1 });
    console.error("STEP_FAIL id=unit reason=no-test-files");
  }

  for (const step of steps) {
    if (step.id === "race-test") {
      // `python` alone is 127 on Linux images that only ship `python3`.
      const python = process.platform === "win32" ? "python" : "python3";
      results.push(runStep(step.id, python, ["tools/git_safety/test_check_race.py"]));
      continue;
    }
    if (step.id === "unit") {
      if (testFiles?.length) {
        const unit = runStep(step.id, process.execPath, buildTestArgs(testFiles), { capture: true });
        testCounts = parseTestCounts(unit.output);
        results.push(unit);
      }
      continue;
    }
    if (step.id === "contract") {
      results.push(runStep(step.id, process.execPath, ["tools/contract_checks/agentops_gitops_contract.mjs"]));
      continue;
    }
    if (step.id === "redaction") {
      const redactionArgs = ["tools/dev/redaction_check.mjs"];
      if (baseSha) redactionArgs.push("--base", baseSha);
      results.push(runStep(step.id, process.execPath, redactionArgs));
      continue;
    }
    if (step.id === "diff-check") {
      const diffArgs = ["diff", "--check", baseSha ? `${baseSha}...HEAD` : "HEAD"];
      results.push(runStep(step.id, "git", diffArgs));
      continue;
    }
    if (step.id === "secret-scan") {
      results.push(runStep(step.id, process.execPath, ["tools/git_safety/scan_staged.mjs"]));
    }
  }

  if (!staged) {
    console.log("STEP_SKIP id=secret-scan reason=no-staged-files");
    results.push({ id: "secret-scan", status: "skip", reason: "no staged files" });
  }

  const verdict = formatVerdict(results);
  const population = buildPopulation(results, {
    tests: testCounts,
    liveness: {
      node: process.version,
      platform: process.platform,
      pid: process.pid,
    },
  });

  // The receipt is a projection of this record, so the record has to survive the
  // run. Writing it must never be able to fail an otherwise-green gate: a witness
  // that can redden the thing it witnesses is not a witness.
  publishPopulation(population);

  console.log(`DEV_CHECK_POPULATION ${JSON.stringify(population)}`);
  console.log(verdict);
  return verdict === "DEV_CHECK_PASS" ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch {
  console.error("DEV_CHECK_FAIL step=setup reason=invalid-run-context");
  process.exitCode = 2;
}
