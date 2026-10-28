import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findRedactionFindings,
  parseAddedLines,
  resolvePullRequestBaseSha,
} from "./redaction_check_lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function parseArgs(args) {
  let explicitBase = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--base" && args[index + 1]) {
      explicitBase = args[index + 1];
      index += 1;
    } else if (args[index] === "--help") {
      console.log("Usage: node tools/dev/redaction_check.mjs [--base <pull-request-base-sha>]");
      process.exit(0);
    } else {
      throw new Error("unsupported argument");
    }
  }
  if (explicitBase && !resolvePullRequestBaseSha({ pull_request: { base: { sha: explicitBase } } })) {
    throw new Error("base must be a 40-character Git SHA");
  }
  return explicitBase;
}

function readEventPayloadBaseSha() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  try {
    return resolvePullRequestBaseSha(JSON.parse(readFileSync(eventPath, "utf8")));
  } catch {
    throw new Error("unable to read GitHub event metadata");
  }
}

function getUntrackedLines() {
  const paths = git(["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean);
  const lines = [];

  for (const relativePath of paths) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const insideRoot = path.relative(repoRoot, absolutePath);
    if (insideRoot.startsWith("..") || path.isAbsolute(insideRoot)) {
      throw new Error("untracked path escaped repository root");
    }
    const content = readFileSync(absolutePath, "utf8");
    if (content.includes("\0")) continue;
    content.split(/\r?\n/).forEach((line, index) => {
      lines.push({ path: relativePath.replaceAll(path.sep, "/"), line: index + 1, content: line });
    });
  }

  return lines;
}

function main() {
  const explicitBase = parseArgs(process.argv.slice(2));
  const baseSha = explicitBase ?? readEventPayloadBaseSha();
  if (
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_EVENT_NAME === "pull_request" &&
    !baseSha
  ) {
    throw new Error("pull-request base SHA is unavailable");
  }

  const diffs = [];
  if (baseSha) diffs.push(git(["diff", "--unified=0", `${baseSha}...HEAD`]));
  diffs.push(git(["diff", "--unified=0", "HEAD"]));

  const changedLines = [
    ...parseAddedLines(diffs.join("\n")),
    ...getUntrackedLines(),
  ];
  const findings = findRedactionFindings(changedLines);

  if (findings.length > 0) {
    console.error(`REDACTION_FAIL findings=${findings.length}`);
    for (const finding of findings) {
      console.error(`REDACTION_FINDING file=${finding.path} line=${finding.line} rule=${finding.rule}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`REDACTION_OK changed_lines=${changedLines.length}`);
}

try {
  main();
} catch (error) {
  console.error(`REDACTION_FAIL reason=${error.message}`);
  process.exitCode = 2;
}
