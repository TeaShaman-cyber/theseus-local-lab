#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const wslHome = process.env.THESEUS_WSL_HOME || "/home/poklad";
const wslRepo = process.env.THESEUS_WSL_REPO || `${wslHome}/theseus-local-lab`;
const codex = `${wslHome}/.local/bin/codex`;

function run(args, timeout = 30_000) {
  const result = spawnSync("wsl.exe", ["-d", "Ubuntu-24.04", "--cd", wslRepo, ...args], {
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function check(name, result, detail) {
  return { name, status: result.ok ? "OK" : "WARN", detail, evidence: result };
}

const checks = [];
checks.push(check("native-codex", run([codex, "--version"]), "WSL-native Codex binary"));
checks.push(check("native-codex-auth", run([codex, "login", "status"]), "WSL-native Codex login status"));
checks.push(check("native-docker", run(["docker", "ps", "--format", "{{.Names}}"]), "WSL Docker socket visibility"));
checks.push(
  check(
    "hook-router",
    run(["node", "hooks/hook-router.mjs", "--event", "UserPromptSubmit"], 45_000),
    "WSL execution of the existing UserPromptSubmit route",
  ),
);

const overall = checks.some((item) => item.status !== "OK") ? "WARN" : "OK";
process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), status: overall, checks }, null, 2)}\n`);
process.exitCode = overall === "OK" ? 0 : 1;
