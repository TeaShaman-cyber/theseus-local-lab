#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function parseArgs(argv) {
  const args = {
    event: process.env.THESEUS_HOOK_EVENT || "unknown",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1] || "";
    if (value === "--event") {
      args.event = next || args.event;
      index += 1;
    }
  }

  return args;
}

function readHookInput() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function runNode(args, input) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function shouldQueueResearch(event) {
  if (process.env.THESEUS_HOOK_RESEARCH === "1") return true;
  return event === "UserPromptSubmit" || event === "PostToolUse";
}

function shouldCheckpointStop() {
  return process.env.THESEUS_HOOK_STOP_CHECKPOINT === "1";
}

function parseJsonOutput(result) {
  try {
    return JSON.parse(String(result?.stdout || ""));
  } catch {
    return null;
  }
}

function stopStatusMessage({ ok, usageOk, pressure }) {
  const pressureStatus = pressure?.status || "unknown";
  const checkpointAttempted = Boolean(pressure?.checkpoint?.attempted);
  const checkpointOk = pressure?.checkpoint?.ok;

  if (pressureStatus === "FAIL" || pressureStatus === "WARN" || checkpointAttempted) {
    if (checkpointAttempted && checkpointOk === false) {
      return "Context pressure recommends compact, but checkpoint refresh failed softly.";
    }
    if (checkpointAttempted && checkpointOk === true) {
      return "Context pressure checkpoint refreshed; manual compact is safe if continuing.";
    }
    return "Context pressure recommends compact; latest checkpoint is still recent.";
  }

  if (ok && usageOk) return "Usage snapshot refreshed.";
  if (ok) return "Context pressure refreshed from cached usage.";
  return "Stop observability hook failed softly.";
}

function response({ ok, route, statusMessage, result }) {
  const stderr = result?.stderr ? String(result.stderr).slice(0, 1000) : "";
  const stdout = result?.stdout ? String(result.stdout).slice(0, 1000) : "";
  if (!ok) {
    if (stderr) process.stderr.write(stderr);
    if (stdout) process.stderr.write(stdout);
  }

  process.stdout.write(
    `${JSON.stringify({
      continue: true,
      suppressOutput: true,
      systemMessage: `${statusMessage} (${route}, ok=${ok})`,
    })}\n`,
  );
}

const args = parseArgs(process.argv.slice(2));
const event = args.event;
const hookInput = readHookInput();

if (event === "PreCompact") {
  const result = runNode(
    [
      "tools/memory_hook/memory_hook.mjs",
      "--mode",
      "compact",
      "--summary",
      "Codex PreCompact lifecycle hook captured state boundary",
      "--goal",
      "Preserve resumable Theseus state before context compaction",
      "--open-loop",
      "Review generated memory_inbox draft and state packet when resuming after compaction",
      "--tag",
      "codex-hook",
      "--tag",
      "precompact",
      "--stdin",
    ],
    hookInput,
  );
  response({
    ok: result.status === 0,
    route: "memory-hook:compact",
    statusMessage: result.status === 0 ? "PreCompact state packet written." : "PreCompact memory hook failed softly.",
    result,
  });
  process.exit(0);
}

if (event === "PostCompact") {
  const checkpointResult = runNode(
    [
      "tools/memory_hook/memory_hook.mjs",
      "--mode",
      "checkpoint",
      "--summary",
      "Codex PostCompact lifecycle hook confirmed compaction boundary survived",
      "--goal",
      "Resume Theseus work from compact state packet, dashboard, AutoMem, and MemPalace rather than relying on lost active context",
      "--open-loop",
      "Verify latest state packet, usage scout, context pressure, and git state before continuing long work",
      "--tag",
      "codex-hook",
      "--tag",
      "postcompact",
      "--stdin",
    ],
    hookInput,
  );
  const pressureResult = runNode(["tools/context_pressure_watch/context_pressure_watch.mjs"], hookInput);
  const ok = checkpointResult.status === 0 && pressureResult.status === 0;
  const result = {
    stdout: [checkpointResult.stdout, pressureResult.stdout].filter(Boolean).join("\n"),
    stderr: [checkpointResult.stderr, pressureResult.stderr].filter(Boolean).join("\n"),
  };
  response({
    ok,
    route: "memory-hook:checkpoint+context-pressure",
    statusMessage: ok ? "PostCompact recovery checkpoint written." : "PostCompact hook failed softly.",
    result,
  });
  process.exit(0);
}

if (shouldQueueResearch(event)) {
  const result = runNode(["hooks/research-queue-hook.mjs"], hookInput);
  response({
    ok: result.status === 0,
    route: "research-queue",
    statusMessage: result.status === 0 ? "Research follow-up queued." : "Research queue hook failed softly.",
    result,
  });
  process.exit(0);
}

if (event === "Stop") {
  const usageResult = runNode(["tools/usage_scout/usage_scout.mjs"], hookInput);
  const pressureResult = runNode(["tools/context_pressure_watch/context_pressure_watch.mjs", "--checkpoint"], hookInput);
  const checkpointResult = shouldCheckpointStop()
    ? runNode(
        [
          "tools/memory_hook/memory_hook.mjs",
          "--mode",
          "checkpoint",
          "--summary",
          "Codex Stop lifecycle hook checkpoint",
          "--tag",
          "codex-hook",
          "--tag",
          "stop",
          "--stdin",
        ],
        hookInput,
      )
    : null;
  const pressure = parseJsonOutput(pressureResult);
  const ok = pressureResult.status === 0 && (!checkpointResult || checkpointResult.status === 0);
  const result = {
    stdout: [usageResult.stdout, pressureResult.stdout, checkpointResult?.stdout].filter(Boolean).join("\n"),
    stderr: [usageResult.stderr, pressureResult.stderr, checkpointResult?.stderr].filter(Boolean).join("\n"),
  };
  response({
    ok,
    route: checkpointResult ? "usage-scout+context-pressure+memory-hook:checkpoint" : "usage-scout+context-pressure",
    statusMessage: stopStatusMessage({ ok, usageOk: usageResult.status === 0, pressure }),
    result,
  });
  process.exit(0);
}

response({
  ok: true,
  route: "noop",
  statusMessage: `Hook router ignored ${event}.`,
});
