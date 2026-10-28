import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSteps, buildTestArgs, collectTestFiles, formatVerdict, nodeRuntimeMatches } from "./check_lib.mjs";
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

function runStep(id, command, args) {
  console.log(`STEP_START id=${id}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    console.error(`STEP_FAIL id=${id} reason=command-unavailable`);
    return { id, status: "fail", exitCode: 127 };
  }
  if (result.status === 0) {
    console.log(`STEP_OK id=${id}`);
    return { id, status: "ok" };
  }

  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  console.error(`STEP_FAIL id=${id} exit=${exitCode}`);
  return { id, status: "fail", exitCode };
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
    if (step.id === "unit") {
      if (testFiles?.length) {
        results.push(runStep(step.id, process.execPath, buildTestArgs(testFiles)));
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
  console.log(verdict);
  return verdict === "DEV_CHECK_PASS" ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch {
  console.error("DEV_CHECK_FAIL step=setup reason=invalid-run-context");
  process.exitCode = 2;
}
