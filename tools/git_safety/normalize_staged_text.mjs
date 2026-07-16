#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".env.example",
  ".html",
  ".js",
  ".json",
  ".jsonl",
  ".jsx",
  ".mjs",
  ".md",
  ".mdx",
  ".py",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const exactTextFiles = new Set([
  ".gitattributes",
  ".gitignore",
  "AGENTS.md",
]);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function stagedNames() {
  const raw = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  return raw.split("\0").filter(Boolean);
}

function extensionOf(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".env.example")) return ".env.example";
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function isLikelyText(name, buffer) {
  const normalizedName = name.replace(/\\/g, "/");
  if (exactTextFiles.has(normalizedName)) return true;
  if (textExtensions.has(extensionOf(normalizedName))) return true;
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.every((byte) => byte === 9 || byte === 10 || byte === 13 || byte >= 32);
}

function normalizeEnd(content) {
  if (content.length === 0) return content;
  return `${content.replace(/[ \t\r\n]+$/g, "")}\n`;
}

const changed = [];

for (const name of stagedNames()) {
  if (!existsSync(name)) continue;
  const buffer = readFileSync(name);
  if (!isLikelyText(name, buffer)) continue;

  const content = buffer.toString("utf8");
  const normalized = normalizeEnd(content);
  if (normalized === content) continue;

  writeFileSync(name, normalized, "utf8");
  execFileSync("git", ["add", "--", name], { stdio: "ignore" });
  changed.push(name);
}

if (changed.length > 0) {
  console.log(`normalized staged text EOF: ${changed.length} file(s)`);
  for (const name of changed) console.log(`- ${name}`);
} else {
  console.log("staged text EOF already normalized");
}
