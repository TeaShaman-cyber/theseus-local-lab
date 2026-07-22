#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const sourcePath = path.join(repoRoot, "hooks", "codex-hooks.json");
const targetPath = path.join(repoRoot, ".codex", "hooks.json");
const sourceText = readFileSync(sourcePath, "utf8");
const config = JSON.parse(sourceText);

if (!config.hooks || typeof config.hooks !== "object") {
  throw new Error("hooks/codex-hooks.json does not contain a hooks object");
}
if (/[A-Za-z]:\\\\Users\\\\/.test(sourceText)) {
  throw new Error("hooks/codex-hooks.json contains a hardcoded Windows user path");
}

mkdirSync(path.dirname(targetPath), { recursive: true });
writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`${targetPath}\n`);
