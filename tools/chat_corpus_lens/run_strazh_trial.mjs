#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const sourcePath = path.resolve(process.env.THESEUS_STRAZH_JSON || path.join(repoRoot, "..", "Страж.json"));
const wslDistro = process.env.THESEUS_WSL_DISTRO || "Ubuntu-24.04";
const graphifyVenv = process.env.GRAPHIFY_VENV || "/home/poklad/.cache/theseus/venvs/graphify";
const dryRun = process.argv.includes("--dry-run");

function fail(message, details = {}) {
  process.stderr.write(`${JSON.stringify({ event: "strazh_trial", status: "failed", message, ...details })}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, ...options });
  if (result.error) fail("spawn_failed", { command, error: result.error.message });
  if (result.status !== 0) fail("command_failed", { command, code: result.status, stderr: result.stderr.trim() });
  return result.stdout.trim();
}

function toWslPath(value) {
  return run("wsl.exe", ["-d", wslDistro, "--exec", "wslpath", "-u", value]);
}

if (!existsSync(sourcePath)) fail("strazh_export_not_found", { source_path: sourcePath });

if (process.platform !== "win32") {
  const result = spawnSync(
    "node",
    ["tools/chat_corpus_lens/chat_corpus_lens.mjs", "--input", sourcePath, "--label", "strazh", "--query", "DeepSeek architecture memory harness Graphify", "--write"],
    { cwd: repoRoot, env: { ...process.env, GRAPHIFY_VENV: graphifyVenv }, stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

const wslRepo = toWslPath(repoRoot);
const wslSource = toWslPath(sourcePath);
const args = [
  "-d", wslDistro, "--cd", wslRepo, "--exec", "env", `GRAPHIFY_VENV=${graphifyVenv}`,
  "node", "tools/chat_corpus_lens/chat_corpus_lens.mjs", "--input", wslSource,
  "--label", "strazh", "--query", "DeepSeek architecture memory harness Graphify", "--write",
];

if (dryRun) {
  process.stdout.write(`${JSON.stringify({ event: "strazh_trial", status: "planned", repo: wslRepo, input: wslSource, distro: wslDistro })}\n`);
  process.exit(0);
}

const result = spawnSync("wsl.exe", args, { cwd: repoRoot, encoding: "utf8", windowsHide: true });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
