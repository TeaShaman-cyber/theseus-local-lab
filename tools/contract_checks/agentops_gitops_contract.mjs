#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const required = [
  "AGENTS.md",
  "GIT_META_SKILL.md",
  ".vscode/tasks.json",
  "docs/reference/git.md",
  "docs/reference/git.rules.yaml",
  "docs/reference/operations.md",
  "docs/reference/operations.rules.yaml",
  "tools/tool_policy/tool_policy.mjs",
  "tools/tool_policy/tool_policy.test.mjs",
  "tools/learning_loop/learning_loop.mjs",
  "tools/learning_loop/learning_loop.test.mjs",
];
const retiredTokens = [
  ["co", "dex"].join(""),
  ["auto", "mem"].join(""),
  ["mem", "palace"].join(""),
  "theseus-memory-stack",
  "theseus-git-hygiene",
  "local-agent-hygiene",
  "theseus-skill-router",
  "theseus-shell-routing",
  ["co", "pilot"].join(""),
];

function activeFiles(repoRoot) {
  const files = [...required];
  const walk = (dir) => {
    for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
      const item = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(item);
      else if (entry.isFile()) files.push(item);
    }
  };
  walk(".agents/skills");
  return [...new Set(files)].sort();
}

export function inspectContract(repoRoot = resolve(import.meta.dirname, "../..")) {
  const violations = [];
  for (const file of required) {
    try {
      if (!statSync(resolve(repoRoot, file)).isFile()) violations.push(`missing=${file}`);
    } catch {
      violations.push(`missing=${file}`);
    }
  }
  if (violations.length === 0) {
    for (const file of activeFiles(repoRoot)) {
      const text = readFileSync(resolve(repoRoot, file), "utf8").toLowerCase();
      for (const retiredMarker of retiredTokens) {
        if (text.includes(retiredMarker)) violations.push(`retired-route=${relative(repoRoot, resolve(repoRoot, file))} marker=${retiredMarker}`);
      }
    }
    try {
      JSON.parse(readFileSync(resolve(repoRoot, ".vscode/tasks.json"), "utf8"));
    } catch {
      violations.push("invalid-json=.vscode/tasks.json");
    }
  }
  return { status: violations.length === 0 ? "OK" : "FAIL", violations };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = inspectContract();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(report.status === "OK" ? "CONTRACT_OK" : `CONTRACT_FAIL ${report.violations.join("; ")}`);
  if (report.status !== "OK") process.exitCode = 1;
}
