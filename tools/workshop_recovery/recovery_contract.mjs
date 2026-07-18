#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { exit } from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const manifestPath = path.join(import.meta.dirname, "recovery_contract.json");
const outputPath = path.join(repoRoot, "outputs", "workshop_recovery", "latest.json");

function run(command, args, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repoRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); resolve({ ok: false, code: null, stdout, stderr: error.message }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, stdout, stderr }); });
  });
}

function httpCheck(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 5_000 }, (response) => {
      response.resume();
      response.on("end", () => resolve({ ok: response.statusCode >= 200 && response.statusCode < 400, status: response.statusCode }));
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (error) => resolve({ ok: false, error: error.message }));
  });
}

function parseArgs(argv) {
  return {
    recover: argv.includes("--recover"),
    write: !argv.includes("--no-write"),
    json: argv.includes("--json"),
    quiet: argv.includes("--quiet"),
  };
}

function parseInspect(stdout) {
  try { return JSON.parse(stdout); } catch { return null; }
}

function statusRank(status) { return { OK: 0, WARN: 1, FAIL: 2 }[status] ?? 2; }

async function inspectContainer(name) {
  const result = await run("docker", ["inspect", name, "--format", "{{json .}}"], 12_000);
  return result.ok ? parseInspect(result.stdout) : null;
}

async function restoreStack(stack) {
  const results = [];
  for (const name of stack.containers) {
    const inspected = await inspectContainer(name);
    if (!inspected) {
      results.push({ name, ok: false, detail: "canonical container missing; bootstrap from compose_file" });
      continue;
    }
    const policy = await run("docker", ["update", "--restart", "always", name], 15_000);
    const started = inspected.State?.Running ? { ok: true, stdout: "already running" } : await run("docker", ["start", name], 30_000);
    results.push({ name, ok: policy.ok && started.ok, policy: policy.ok ? "always" : policy.stderr, action: started.stdout.trim() || started.stderr.trim() });
  }
  return { ok: results.every((result) => result.ok), containers: results };
}

async function auditStack(stack, now) {
  const containers = [];
  let newestStart = 0;
  for (const name of stack.containers) {
    const inspected = await inspectContainer(name);
    if (!inspected) {
      containers.push({ name, status: "FAIL", detail: "container missing" });
      continue;
    }
    const started = Date.parse(inspected.State?.StartedAt || "") || 0;
    newestStart = Math.max(newestStart, started);
    if (!inspected.State?.Running) {
      containers.push({ name, status: "FAIL", detail: `not running (exit ${inspected.State?.ExitCode ?? "unknown"})` });
    } else if (inspected.HostConfig?.RestartPolicy?.Name !== "always") {
      containers.push({ name, status: "WARN", detail: `restart=${inspected.HostConfig?.RestartPolicy?.Name || "none"}; expected always` });
    } else {
      containers.push({ name, status: "OK", detail: "running; restart=always" });
    }
  }
  const ageSeconds = newestStart ? Math.max(0, (now - newestStart) / 1000) : Infinity;
  let health = null;
  if (stack.health_url) {
    health = await httpCheck(stack.health_url);
    if (!health.ok && ageSeconds < stack.startup_grace_seconds) health.status = "WARN";
    else health.status = health.ok ? "OK" : "FAIL";
  }
  let commandCheck = null;
  if (Array.isArray(stack.command_check) && stack.command_check.length > 0) {
    const [command, ...commandArgs] = stack.command_check;
    const result = await run(command, commandArgs, 15_000);
    commandCheck = {
      ok: result.ok,
      status: result.ok ? "OK" : "FAIL",
      detail: (result.stderr || result.stdout || "no output").trim().slice(0, 400),
    };
  }
  const statuses = [...containers.map((entry) => entry.status), health?.status, commandCheck?.status].filter(Boolean);
  const status = statuses.reduce((worst, current) => statusRank(current) > statusRank(worst) ? current : worst, "OK");
  return { id: stack.id, status, startup_age_seconds: Math.round(ageSeconds), containers, health, command_check: commandCheck };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const docker = await run("docker", ["version", "--format", "{{.Server.Version}}"], 15_000);
  const recovery = [];
  if (args.recover && docker.ok) {
    for (const stack of manifest.stacks) recovery.push({ id: stack.id, ...(await restoreStack(stack)) });
  }
  const now = Date.now();
  const stacks = docker.ok ? await Promise.all(manifest.stacks.map((stack) => auditStack(stack, now))) : [];
  const overall = docker.ok
    ? stacks.reduce((worst, stack) => statusRank(stack.status) > statusRank(worst) ? stack.status : worst, "OK")
    : "FAIL";
  const report = { generated_at: new Date().toISOString(), overall, docker: docker.ok ? { status: "OK", version: docker.stdout.trim() } : { status: "FAIL", detail: docker.stderr || docker.stdout }, recovery, stacks };
  if (args.write) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else if (!args.quiet) console.log(`workshop recovery: ${overall}; ${stacks.map((stack) => `${stack.id}=${stack.status}`).join(", ")}`);
  if (overall === "FAIL") process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); exit(1); });
