#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";
import { collectUsageSnapshot } from "../usage_scout/usage_scout.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function parseArgs(argv) {
  const args = {
    checkpoint: false,
    warnUsagePercent: 70,
    failUsagePercent: 90,
    warnTokenRatio: 0.65,
    failTokenRatio: 0.85,
    warnPacketMinutes: 60,
    failPacketMinutes: 180,
    minCheckpointMinutes: 45,
    refreshUsage: true,
    json: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1] || "";
    if (item === "--checkpoint") args.checkpoint = true;
    if (item === "--warn-usage-percent") {
      args.warnUsagePercent = Number(next);
      index += 1;
    }
    if (item === "--fail-usage-percent") {
      args.failUsagePercent = Number(next);
      index += 1;
    }
    if (item === "--warn-packet-minutes") {
      args.warnPacketMinutes = Number(next);
      index += 1;
    }
    if (item === "--fail-packet-minutes") {
      args.failPacketMinutes = Number(next);
      index += 1;
    }
    if (item === "--min-checkpoint-minutes") {
      args.minCheckpointMinutes = Number(next);
      index += 1;
    }
    if (item === "--no-refresh-usage") args.refreshUsage = false;
  }

  return args;
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function latestFile(dir, predicate = () => true) {
  const full = path.resolve(repoRoot, dir);
  if (!existsSync(full)) return null;
  return readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => {
      const filePath = path.join(full, entry.name);
      const stat = statSync(filePath);
      return { name: entry.name, path: filePath, mtime: stat.mtime, length: stat.size };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] || null;
}

function minutesSince(date, now = new Date()) {
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 60_000);
}

function statusMax(statuses) {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARN")) return "WARN";
  return "OK";
}

function thresholdStatus(value, warn, fail) {
  if (!Number.isFinite(value)) return "OK";
  if (value >= fail) return "FAIL";
  if (value >= warn) return "WARN";
  return "OK";
}

function staleStatus(ageMinutes, warn, fail) {
  if (!Number.isFinite(ageMinutes)) return "WARN";
  if (ageMinutes >= fail) return "FAIL";
  if (ageMinutes >= warn) return "WARN";
  return "OK";
}

function safeRound(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function runMemoryCheckpoint(summary, goal, openLoop) {
  return spawnSync(
    process.execPath,
    [
      "tools/memory_hook/memory_hook.mjs",
      "--mode",
      "compact",
      "--summary",
      summary,
      "--goal",
      goal,
      "--open-loop",
      openLoop,
      "--tag",
      "context-pressure",
      "--tag",
      "compact-recommended",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  let usageRefresh = { attempted: false, ok: null, error: null };
  let usage = null;
  if (args.refreshUsage) {
    usageRefresh = { attempted: true, ok: false, error: null };
    try {
      const result = await collectUsageSnapshot({ workspace: repoRoot });
      usage = result.snapshot;
      usageRefresh = {
        attempted: true,
        ok: true,
        changed: result.changed,
        observed_at: result.snapshot?.observed_at || null,
      };
    } catch (error) {
      usageRefresh = { attempted: true, ok: false, error: error.message };
    }
  }
  if (!usage) usage = readJson(path.join(repoRoot, "outputs", "usage_scout", "latest.json"));
  const bindingLimit = usage?.limits?.find((limit) => limit.key === usage?.derived?.binding_limit_key);
  const usedPercent = Number(bindingLimit?.used_percent);
  const usageStatus = thresholdStatus(usedPercent, args.warnUsagePercent, args.failUsagePercent);

  const lastTotal = Number(usage?.tokens?.last_event?.total);
  const contextWindow = Number(usage?.tokens?.model_context_window);
  const tokenRatio = Number.isFinite(lastTotal) && Number.isFinite(contextWindow) && contextWindow > 0
    ? lastTotal / contextWindow
    : null;
  const tokenStatus = thresholdStatus(tokenRatio, args.warnTokenRatio, args.failTokenRatio);

  const latestPacket = latestFile("outputs/state_packets", (name) => name.endsWith(".md"));
  const packetAgeMinutes = latestPacket ? minutesSince(latestPacket.mtime, now) : null;
  const packetStatus = staleStatus(packetAgeMinutes, args.warnPacketMinutes, args.failPacketMinutes);

  const latestTimeline = latestFile("outputs/session_timeline", (name) => name.endsWith(".jsonl"));
  const timelineAgeMinutes = latestTimeline ? minutesSince(latestTimeline.mtime, now) : null;
  const timelineStatus = staleStatus(timelineAgeMinutes, 180, 720);

  const status = statusMax([usageStatus, tokenStatus, packetStatus, timelineStatus]);
  const shouldCheckpoint =
    args.checkpoint &&
    status !== "OK" &&
    (!Number.isFinite(packetAgeMinutes) || packetAgeMinutes >= args.minCheckpointMinutes);

  let checkpoint = { attempted: false, ok: null, reason: "not requested or not needed" };
  if (shouldCheckpoint) {
    const result = runMemoryCheckpoint(
      `Context pressure ${status}: usage ${Number.isFinite(usedPercent) ? `${usedPercent}%` : "unknown"}, packet ${safeRound(packetAgeMinutes, 1) ?? "missing"}m old`,
      "Preserve Theseus working state before manual or automatic context compaction.",
      "After compact, verify dashboard context-pressure, usage-scout, latest state packet, and git state before continuing.",
    );
    checkpoint = {
      attempted: true,
      ok: result.status === 0,
      code: result.status,
      stdout: result.stdout ? result.stdout.slice(0, 1200) : "",
      stderr: result.stderr ? result.stderr.slice(0, 1200) : "",
    };
  } else if (args.checkpoint && status !== "OK") {
    checkpoint = {
      attempted: false,
      ok: null,
      reason: `latest packet is only ${safeRound(packetAgeMinutes, 1) ?? "unknown"}m old`,
    };
  }

  const output = {
    generated_at: now.toISOString(),
    status,
    recommendation:
      status === "OK"
        ? "continue"
        : checkpoint.attempted && checkpoint.ok
          ? "compact checkpoint refreshed; manual compact is safe if needed"
          : "compact checkpoint recommended before further long work",
    signals: {
      usage: {
        status: usageStatus,
        used_percent: Number.isFinite(usedPercent) ? usedPercent : null,
        remaining_percent: Number.isFinite(Number(bindingLimit?.remaining_percent_derived))
          ? Number(bindingLimit.remaining_percent_derived)
          : null,
        window_minutes: bindingLimit?.window_minutes ?? null,
        observed_at: usage?.observed_at || null,
        refresh: usageRefresh,
      },
      active_turn_tokens: {
        status: tokenStatus,
        last_event_total: Number.isFinite(lastTotal) ? lastTotal : null,
        model_context_window: Number.isFinite(contextWindow) ? contextWindow : null,
        ratio: safeRound(tokenRatio, 4),
      },
      state_packet: {
        status: packetStatus,
        latest: latestPacket?.name || null,
        age_minutes: safeRound(packetAgeMinutes, 1),
      },
      session_timeline: {
        status: timelineStatus,
        latest: latestTimeline?.name || null,
        age_minutes: safeRound(timelineAgeMinutes, 1),
      },
    },
    checkpoint,
  };

  const outDir = path.join(repoRoot, "outputs", "context_pressure");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outDir, `${now.toISOString().slice(0, 10)}.jsonl`), `${JSON.stringify(output)}\n`, {
    encoding: "utf8",
    flag: "a",
  });

  await writeTimelineEvent(
    {
      source: "context-pressure-watch",
      event: "context-pressure-check",
      note: `${status}: ${output.recommendation}`,
      tags: ["context-pressure", "compact", status.toLowerCase()],
      artifacts: [path.join("outputs", "context_pressure", "latest.json"), latestPacket?.name].filter(Boolean),
      metrics: {
        used_percent: output.signals.usage.used_percent,
        token_ratio: output.signals.active_turn_tokens.ratio,
        packet_age_minutes: output.signals.state_packet.age_minutes,
      },
    },
    { workspace: repoRoot },
  );

  console.log(JSON.stringify(output, null, 2));
  if (checkpoint.attempted && !checkpoint.ok) process.exit(1);
}

await main();
