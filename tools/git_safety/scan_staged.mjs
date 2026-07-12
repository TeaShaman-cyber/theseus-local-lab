#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const blockedFilePatterns = [
  /(^|[/\\])\.env$/i,
  /(^|[/\\])\.env\.(?!example$)[^/\\]+$/i,
  /\.(pem|pfx|p12|key)$/i,
];

const tokenPatterns = [
  { name: "OpenAI-style key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub classic token", regex: /\bghp_[A-Za-z0-9_]{20,}\b/ },
  { name: "GitHub fine-grained token", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key block", regex: /BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY/ },
];

const sensitiveAssignment = /^\+\s*([A-Za-z0-9_]*(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_?KEY)[A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/i;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function stagedNames() {
  const raw = git(["diff", "--cached", "--name-only", "-z"]);
  return raw.split("\0").filter(Boolean);
}

function isPlaceholder(value) {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  if (trimmed === "") return true;
  if (/^\$\{?[A-Za-z0-9_]+\}?/.test(trimmed)) return true;
  if (/^(<.*>|REPLACE_ME|CHANGE_ME|your[_-]?value|example|placeholder)$/i.test(trimmed)) return true;
  if (/^(true|false|null)$/i.test(trimmed)) return true;
  return false;
}

const findings = [];

for (const name of stagedNames()) {
  if (blockedFilePatterns.some((pattern) => pattern.test(name))) {
    findings.push(`${name}: blocked secret-like filename`);
  }
}

const diff = git(["diff", "--cached", "--no-ext-diff", "--unified=0", "--"]);
for (const [index, line] of diff.split(/\r?\n/).entries()) {
  if (!line.startsWith("+") || line.startsWith("+++")) continue;

  for (const pattern of tokenPatterns) {
    if (pattern.regex.test(line)) {
      findings.push(`diff line ${index + 1}: possible ${pattern.name}`);
    }
  }

  const assignment = line.match(sensitiveAssignment);
  if (assignment && !isPlaceholder(assignment[2])) {
    findings.push(`diff line ${index + 1}: non-placeholder value for ${assignment[1]}`);
  }
}

if (findings.length > 0) {
  console.error("Refusing commit: staged changes look like they may contain secrets.");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  console.error("Move real values into Infisical or an ignored local file, then stage again.");
  process.exit(1);
}

console.log("staged secret scan ok");
