#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function unwrapWindowsDevicePath(path) {
  return String(path || "").replace(/^\\\\\?\\/, "");
}

export async function readLatestTurnContext(transcriptPath) {
  const path = unwrapWindowsDevicePath(transcriptPath);
  if (!path) return {};

  let latest = {};
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.includes('"turn_context"')) continue;
    try {
      const record = JSON.parse(line);
      if (record.type !== "turn_context") continue;
      const payload = record.payload || {};
      latest = {
        model: clean(payload.model),
        reasoning_effort: clean(payload.reasoning_effort || payload.effort),
      };
    } catch {
      // A partial JSONL tail must not break the lifecycle hook.
    }
  }
  return latest;
}

export function resolveRuntime(hookPayload = {}, turnContext = {}, previous = {}) {
  return {
    model: clean(hookPayload.model || turnContext.model || previous.model) || "unknown",
    reasoning_effort:
      clean(
        hookPayload.reasoning_effort ||
          hookPayload.effort ||
          turnContext.reasoning_effort ||
          previous.reasoning_effort,
      ) || "unknown",
  };
}

export function evaluateTransition(previous, current) {
  if (!previous?.model) {
    return { status: "initialized", changed: true, fields: ["model", "reasoning_effort"] };
  }

  const fields = ["model", "reasoning_effort"].filter(
    (field) => clean(previous[field]) !== clean(current[field]),
  );
  return {
    status: fields.length ? "changed" : "stable",
    changed: fields.length > 0,
    fields,
  };
}

export function buildPreflight(previous, current, transition) {
  if (!transition.changed) return "";
  const before = previous?.model
    ? `${previous.model}/${previous.reasoning_effort || "unknown"}`
    : "uninitialized";
  const after = `${current.model}/${current.reasoning_effort}`;
  return [
    `Theseus runtime ${transition.status}: ${before} -> ${after}.`,
    "Before non-trivial work: recall AutoMem, then use MemPalace for episodic detail; route through theseus-skill-router.",
    "Before shell work: apply theseus-shell-routing; prefer a checked-in Node wrapper, VS Code task, MCP, or direct WSL route.",
    "PowerShell is a thin launcher only. Parse JSON/JSONL with Node or a checked-in Unix script, never nested PowerShell -> WSL -> jq.",
    "Check the workshop dashboard before widening the task and close expected Git warnings with a verified checkpoint when work is complete.",
    "Verify one small canary before widening the task, and record failures without blaming the model by default.",
  ].join(" ");
}

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

export async function syncFromUsageScout(options = {}) {
  const workspace = options.workspace || process.cwd();
  const statePath = options.statePath || join(workspace, "outputs", "model_switch_guard", "state.json");
  const usagePath = options.usagePath || join(workspace, "outputs", "usage_scout", "latest.json");
  const usage = JSON.parse(await readFile(usagePath, "utf8"));
  const current = {
    model: clean(usage?.codex?.model) || "unknown",
    reasoning_effort: clean(usage?.codex?.reasoning_effort) || "unknown",
  };
  if (current.model === "unknown" && current.reasoning_effort === "unknown") {
    throw new Error("Usage scout snapshot does not contain codex model identity");
  }

  const previous = await readState(statePath);
  const transition = evaluateTransition(previous, current);
  const observedAt = usage.observed_at || usage.collected_at || new Date().toISOString();
  const nextState = {
    ...current,
    observed_at: observedAt,
    synchronized_at: new Date().toISOString(),
    source: "usage-scout",
  };

  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  let timeline = null;
  if (transition.changed || options.writeEvent) {
    timeline = await writeTimelineEvent(
      {
        source: "model-switch-guard",
        event: "model-runtime-synchronized",
        note: `Model runtime synchronized from usage scout: ${current.model}/${current.reasoning_effort}.`,
        tags: ["model-switch", "usage-scout", "sync", ...transition.fields],
        metrics: {
          previous_model: previous.model || null,
          previous_reasoning_effort: previous.reasoning_effort || null,
          current_model: current.model,
          current_reasoning_effort: current.reasoning_effort,
        },
        artifacts: [relative(workspace, statePath), relative(workspace, usagePath)],
      },
      { workspace, sinkUrl: options.sinkUrl },
    );
  }

  return { current, previous, transition, statePath, usagePath, timeline };
}

export async function runModelSwitchGuard(hookPayload = {}, options = {}) {
  const workspace = options.workspace || process.cwd();
  const statePath = options.statePath || join(workspace, "outputs", "model_switch_guard", "state.json");
  const previous = await readState(statePath);
  let turnContext = {};
  try {
    turnContext = await readLatestTurnContext(hookPayload.transcript_path);
  } catch {
    // Hook payload model is sufficient; transcript enrichment is optional.
  }

  const current = resolveRuntime(hookPayload, turnContext, previous);
  const transition = evaluateTransition(previous, current);
  const preflight = buildPreflight(previous, current, transition);
  const observedAt = new Date().toISOString();
  const nextState = { ...current, observed_at: observedAt };

  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  let timeline = null;
  if (transition.changed) {
    timeline = await writeTimelineEvent(
      {
        source: "model-switch-guard",
        event: transition.status === "initialized" ? "model-runtime-initialized" : "model-runtime-changed",
        note: preflight,
        tags: ["model-switch", "preflight", ...transition.fields],
        metrics: {
          previous_model: previous.model || null,
          previous_reasoning_effort: previous.reasoning_effort || null,
          current_model: current.model,
          current_reasoning_effort: current.reasoning_effort,
        },
        artifacts: [relative(workspace, statePath)],
      },
      { workspace, sinkUrl: options.sinkUrl },
    );
  }

  return { current, previous, transition, preflight, statePath, timeline };
}

function hookResponse(result) {
  return {
    continue: true,
    suppressOutput: true,
    ...(result.preflight ? { systemMessage: result.preflight } : {}),
  };
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function main() {
  try {
    if (process.argv.includes("--sync-from-usage-scout")) {
      const result = await syncFromUsageScout();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    const payload = await readStdin();
    const result = await runModelSwitchGuard(payload);
    process.stdout.write(`${JSON.stringify(hookResponse(result))}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        continue: true,
        suppressOutput: true,
        systemMessage: `Model-switch guard failed softly: ${String(error?.message || error).slice(0, 300)}`,
      })}\n`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
