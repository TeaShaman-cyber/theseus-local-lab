#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const wslExe = process.env.WSL_EXE || "wsl.exe";
const distro = process.env.THESEUS_WSL_DISTRO || "Ubuntu-24.04";
const python = process.env.THESEUS_SONAR_PYTHON || "/home/poklad/.cache/theseus-sonar/venv/bin/python";

function toWslPath(value) {
  const normalized = path.resolve(value).replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

const command = process.argv[2] || "status";
const forwarded = process.argv.slice(3);
const script = `${toWslPath(repoRoot)}/tools/sonar_local/sonar_local.py`;
const args = ["-d", distro, "--", python, script, command, ...forwarded];

if (command === "bootstrap") {
  const bootstrap = `${toWslPath(repoRoot)}/tools/sonar_local/bootstrap_wsl.sh`;
  const result = spawnSync(
    wslExe,
    ["-d", distro, "--", "bash", "--noprofile", "--norc", bootstrap],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

if (command === "mcp-smoke") {
  const smoke = `${toWslPath(repoRoot)}/tools/sonar_local/mcp_smoke.py`;
  const result = spawnSync(wslExe, ["-d", distro, "--", python, smoke, ...forwarded], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

const result = spawnSync(wslExe, args, {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error?.code === "ENOENT") {
  console.error(JSON.stringify({ status: "FAIL", reason: "wsl_or_workspace_unavailable" }));
}
if (result.status !== 0) {
  console.error("Run `node tools/sonar_local/run_wsl.mjs bootstrap` once if the Sonar venv is missing.");
}
process.exit(result.status ?? 1);
