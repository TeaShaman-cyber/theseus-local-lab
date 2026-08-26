#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const sourcePath = path.join(repoRoot, "hooks", "codex-hooks.json");
const runtimePath = path.join(repoRoot, ".codex", "hooks.json");

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

function readManifest(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

if (!existsSync(sourcePath) || !existsSync(runtimePath)) {
  console.log("HOOKS_MISSING");
  process.exitCode = 1;
} else {
  try {
    const source = readManifest(sourcePath);
    const runtime = readManifest(runtimePath);
    if (!source.hooks || typeof source.hooks !== "object" || !runtime.hooks || typeof runtime.hooks !== "object") {
      console.log("HOOKS_INVALID");
      process.exitCode = 1;
    } else if (JSON.stringify(sorted(source)) !== JSON.stringify(sorted(runtime))) {
      console.log("HOOKS_MISMATCH");
      process.exitCode = 1;
    } else {
      console.log("HOOKS_MATCH");
    }
  } catch {
    console.log("HOOKS_INVALID");
    process.exitCode = 1;
  }
}
