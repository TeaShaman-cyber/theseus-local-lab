#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const userProfile = process.env.USERPROFILE || process.env.HOME || "";
const defaultOutputDir = path.join(repoRoot, "outputs", "codex_startup_watch", new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"));
const outputDir = path.resolve(readArg("--output-dir") || defaultOutputDir);
const durationSec = Number(readArg("--duration-sec") || 180);
const intervalMs = Math.max(500, Number(readArg("--interval-ms") || 1000));
const handlePath = process.env.THESEUS_HANDLE || path.join(userProfile, "Tools", "Sysinternals", "handle64.exe");
const eventsPath = path.join(outputDir, "events.jsonl");

if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error("--duration-sec must be positive");
if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error("--interval-ms must be positive");

mkdirSync(outputDir, { recursive: true });

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function writeEvent(event) {
  appendFileSync(eventsPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, "utf8");
}

function run(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, code: null, stdout, stderr, timed_out: true });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => finish({ ok: false, code: null, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => finish({ ok: code === 0, code, stdout, stderr, timed_out: false }));
  });
}

function parseJson(stdout) {
  try {
    const value = JSON.parse(stdout.trim());
    return Array.isArray(value) ? value : value ? [value] : [];
  } catch {
    return [];
  }
}

async function listCodexProcesses() {
  const script = "$p=Get-CimInstance Win32_Process -Filter \"Name='codex.exe'\"; $p | Select-Object ProcessId,ParentProcessId,CreationDate,WorkingSetSize,ReadTransferCount,WriteTransferCount,PageFaults | ConvertTo-Json -Compress";
  const result = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], 5000);
  return { result, processes: parseJson(result.stdout) };
}

async function findRolloutHandles(pid) {
  if (!existsSync(handlePath)) {
    return { available: false, path: handlePath, hits: [], error: "handle64.exe not found" };
  }
  const result = await run(handlePath, ["-nobanner", "-p", String(pid)], 5000);
  const hits = result.stdout
    .split(/\r?\n/)
    .filter((line) => /\\\.codex\\(?:sessions|archived_sessions)\\.*rollout-.*\.jsonl/i.test(line))
    .map((line) => line.replaceAll(userProfile, "<user-profile>").trim())
    .slice(0, 20);
  return { available: true, ok: result.ok, code: result.code, timed_out: result.timed_out, hits, stderr: result.stderr.trim().slice(0, 300) };
}

async function sample() {
  const listed = await listCodexProcesses();
  const processes = [];
  for (const processInfo of listed.processes) {
    const pid = Number(processInfo.ProcessId);
    if (!Number.isFinite(pid)) continue;
    const handles = await findRolloutHandles(pid);
    processes.push({
      pid,
      parent_pid: Number(processInfo.ParentProcessId) || null,
      creation_date: processInfo.CreationDate || null,
      working_set_bytes: Number(processInfo.WorkingSetSize) || null,
      read_transfer_bytes: Number(processInfo.ReadTransferCount) || null,
      write_transfer_bytes: Number(processInfo.WriteTransferCount) || null,
      page_faults: Number(processInfo.PageFaults) || null,
      rollout_handles: handles,
    });
  }
  return {
    kind: "sample",
    process_query_ok: listed.result.ok,
    process_query_timed_out: listed.result.timed_out,
    process_query_error: listed.result.stderr.trim().slice(0, 300),
    processes,
  };
}

writeEvent({ kind: "watch_started", duration_sec: durationSec, interval_ms: intervalMs, handle_path: handlePath.replaceAll(userProfile, "<user-profile>") });
const deadline = Date.now() + durationSec * 1000;
let sampleCount = 0;
while (Date.now() < deadline) {
  writeEvent(await sample());
  sampleCount += 1;
  await delay(intervalMs);
}
writeEvent({ kind: "watch_finished", sample_count: sampleCount });
console.log(JSON.stringify({ output_dir: outputDir, events: eventsPath, sample_count: sampleCount }));
