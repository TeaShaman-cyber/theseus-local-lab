#!/usr/bin/env node

import { open } from "node:fs/promises";
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const DEFAULT_TAIL_BYTES = 16 * 1024 * 1024;

function value(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return null;
}

function numberOrNull(input) {
  if (input === undefined || input === null || input === "") return null;
  const number = Number(input);
  return Number.isFinite(number) ? number : null;
}

function isoFromTimestamp(input) {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    const number = Number(input);
    const milliseconds = number > 10_000_000_000 ? number : number * 1000;
    return new Date(milliseconds).toISOString();
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function walkJsonl(dir, result = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walkJsonl(path, result);
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const info = await stat(path);
      result.push({ path, mtimeMs: info.mtimeMs, size: info.size });
    }
  }
  return result;
}

export async function findLatestRollout(codexHome = process.env.CODEX_HOME || join(homedir(), ".codex")) {
  const files = await walkJsonl(join(codexHome, "sessions"));
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}

export async function readRolloutTail(path, maxBytes = DEFAULT_TAIL_BYTES) {
  const info = await stat(path);
  const length = Math.min(info.size, maxBytes);
  const start = Math.max(0, info.size - length);
  const buffer = Buffer.alloc(length);
  const handle = await open(path, "r");
  try {
    await handle.read(buffer, 0, length, start);
  } finally {
    await handle.close();
  }
  const lines = buffer.toString("utf8").split(/\r?\n/);
  if (start > 0) lines.shift();
  return lines.filter(Boolean);
}

export function selectLatestRecords(lines) {
  let usageEvent = null;
  let turnContext = null;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (usageEvent && turnContext) break;
    if (!line.includes('"token_count"') && !line.includes('"turn_context"')) continue;
    try {
      const record = JSON.parse(line);
      if (!usageEvent && record.type === "event_msg" && record.payload?.type === "token_count") {
        usageEvent = record;
      }
      if (!turnContext && record.type === "turn_context") turnContext = record;
    } catch {
      // Ignore a partially written final line.
    }
  }
  return { usageEvent, turnContext };
}

function normalizeUsage(input) {
  if (!input || typeof input !== "object") return null;
  return {
    input: numberOrNull(value(input, "input_tokens", "inputTokens")),
    cached_input: numberOrNull(value(input, "cached_input_tokens", "cachedInputTokens")),
    output: numberOrNull(value(input, "output_tokens", "outputTokens")),
    reasoning_output: numberOrNull(
      value(input, "reasoning_output_tokens", "reasoningOutputTokens", "reasoning_tokens", "reasoningTokens"),
    ),
    total: numberOrNull(value(input, "total_tokens", "totalTokens")),
  };
}

function normalizeWindow(window, wireSlot, limitId = null, limitName = null) {
  if (!window || typeof window !== "object") return null;
  const usedPercent = numberOrNull(value(window, "used_percent", "usedPercent"));
  const windowMinutes = numberOrNull(value(window, "window_minutes", "windowDurationMins", "windowMinutes"));
  const resetsAt = isoFromTimestamp(value(window, "resets_at", "resetsAt"));
  const key = [limitId || "unlabelled", windowMinutes ?? "unknown", wireSlot].join(":");
  return {
    key,
    limit_id: limitId,
    limit_name: limitName,
    wire_slot: wireSlot,
    window_minutes: windowMinutes,
    used_percent: usedPercent,
    remaining_percent_derived: usedPercent === null ? null : Math.max(0, Math.min(100, 100 - usedPercent)),
    resets_at: resetsAt,
  };
}

export function normalizeLimits(rateLimits) {
  if (!rateLimits || typeof rateLimits !== "object") return [];
  const buckets = value(rateLimits, "rate_limits_by_limit_id", "rateLimitsByLimitId");
  if (buckets && typeof buckets === "object") {
    return Object.entries(buckets).flatMap(([limitId, snapshot]) => {
      const name = value(snapshot, "limit_name", "limitName");
      return [
        normalizeWindow(snapshot.primary, "primary", limitId, name),
        normalizeWindow(snapshot.secondary, "secondary", limitId, name),
      ].filter(Boolean);
    });
  }
  const limitId = value(rateLimits, "limit_id", "limitId");
  const limitName = value(rateLimits, "limit_name", "limitName");
  return [
    normalizeWindow(rateLimits.primary, "primary", limitId, limitName),
    normalizeWindow(rateLimits.secondary, "secondary", limitId, limitName),
  ].filter(Boolean);
}

function bindingLimit(limits) {
  return limits
    .filter((limit) => limit.used_percent !== null)
    .sort((a, b) => b.used_percent - a.used_percent)[0] || null;
}

function fingerprint(snapshot) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        observed_at: snapshot.observed_at,
        model: snapshot.codex.model,
        reasoning_effort: snapshot.codex.reasoning_effort,
        tokens: snapshot.tokens,
        limits: snapshot.limits,
        plan_type: snapshot.account.plan_type,
      }),
    )
    .digest("hex")
    .slice(0, 20);
}

export function normalizeSnapshot(records, now = new Date()) {
  const payload = records.usageEvent?.payload || {};
  const info = payload.info || {};
  const context = records.turnContext?.payload || {};
  const rateLimits = value(payload, "rate_limits", "rateLimits") || value(info, "rate_limits", "rateLimits");
  const limits = normalizeLimits(rateLimits);
  const binding = bindingLimit(limits);
  const observedAt = isoFromTimestamp(records.usageEvent?.timestamp) || now.toISOString();
  const warnings = [];
  if (!records.usageEvent) warnings.push("token-count-event-missing");
  if (!rateLimits) warnings.push("rate-limits-missing");
  if (!records.turnContext) warnings.push("turn-context-missing");

  const snapshot = {
    schema_version: 1,
    observed_at: observedAt,
    collected_at: now.toISOString(),
    source: "rollout",
    codex: {
      model: value(context, "model") || null,
      reasoning_effort: value(context, "reasoning_effort", "effort") || null,
      service_tier: value(context, "service_tier", "serviceTier") || null,
    },
    tokens: {
      last_event: normalizeUsage(value(info, "last_token_usage", "lastTokenUsage")),
      session_cumulative: normalizeUsage(value(info, "total_token_usage", "totalTokenUsage")),
      model_context_window: numberOrNull(value(info, "model_context_window", "modelContextWindow")),
    },
    limits,
    credits: {
      has_credits: value(rateLimits, "has_credits", "hasCredits"),
      unlimited: value(rateLimits, "unlimited"),
      balance: numberOrNull(value(rateLimits, "credits_balance", "creditsBalance", "balance")),
    },
    account: {
      plan_type: value(rateLimits, "plan_type", "planType"),
    },
    derived: {
      binding_limit_key: binding?.key || null,
      confidence: binding ? "medium" : "none",
      evidence: binding ? ["highest used_percent in one rollout snapshot"] : [],
    },
    quality: {
      complete_snapshot: false,
      stale: false,
      shape_changed: false,
      warnings,
    },
  };
  snapshot.fingerprint = fingerprint(snapshot);
  return snapshot;
}

async function readPrevious(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function shapeKey(snapshot) {
  return (snapshot?.limits || [])
    .map((limit) => `${limit.limit_id || ""}:${limit.window_minutes || ""}:${limit.wire_slot}`)
    .sort()
    .join("|");
}

export async function collectUsageSnapshot(options = {}) {
  const workspace = options.workspace || process.cwd();
  const outputDir = options.outputDir || join(workspace, "outputs", "usage_scout");
  const latestPath = join(outputDir, "latest.json");
  const rollout = options.rollout || (await findLatestRollout(options.codexHome));
  if (!rollout?.path) throw new Error("No Codex rollout JSONL found");

  const lines = await readRolloutTail(rollout.path, options.maxBytes || DEFAULT_TAIL_BYTES);
  const records = selectLatestRecords(lines);
  const snapshot = normalizeSnapshot(records, options.now || new Date());
  const previous = await readPrevious(latestPath);
  snapshot.quality.shape_changed = Boolean(previous && shapeKey(previous) !== shapeKey(snapshot));
  if (snapshot.quality.shape_changed) snapshot.quality.warnings.push("rate-limit-shape-changed");

  const changed = previous?.fingerprint !== snapshot.fingerprint;
  if (options.write !== false) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    if (changed) {
      const historyPath = join(outputDir, `${snapshot.observed_at.slice(0, 10)}.jsonl`);
      await appendFile(historyPath, `${JSON.stringify(snapshot)}\n`, "utf8");
      await writeTimelineEvent(
        {
          source: "usage-scout",
          event: "usage-snapshot-updated",
          note: `${snapshot.codex.model || "unknown"}/${snapshot.codex.reasoning_effort || "unknown"}; ${snapshot.limits.length} limit windows`,
          tags: ["usage", "limits", snapshot.quality.warnings.length ? "incomplete" : "observed"],
          metrics: {
            limit_windows: snapshot.limits.length,
            binding_used_percent: bindingLimit(snapshot.limits)?.used_percent ?? null,
            last_event_tokens: snapshot.tokens.last_event?.total ?? null,
          },
          artifacts: ["outputs/usage_scout/latest.json"],
        },
        { workspace, sinkUrl: options.sinkUrl },
      );
    }
  }
  return { snapshot, changed, rollout: { name: basename(rollout.path), size: rollout.size || null } };
}

async function main() {
  const result = await collectUsageSnapshot();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
