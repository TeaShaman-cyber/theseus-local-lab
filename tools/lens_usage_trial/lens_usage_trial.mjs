#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectUsageSnapshot } from "../usage_scout/usage_scout.mjs";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "lens_usage_trial");

function parseArgs(argv) {
  const args = {
    command: "mark",
    trial: "",
    route: "lens",
    goal: "",
    note: "",
    lens: "",
    quality: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (["start", "end", "report"].includes(item)) args.command = item;
    else if (item === "--trial") args.trial = argv[++i] || "";
    else if (item === "--route") args.route = argv[++i] || args.route;
    else if (item === "--goal") args.goal = argv[++i] || "";
    else if (item === "--note") args.note = argv[++i] || "";
    else if (item === "--lens") args.lens = argv[++i] || "";
    else if (item === "--quality") args.quality = argv[++i] || "";
  }

  if (!args.trial) args.trial = `${new Date().toISOString().slice(0, 10)}-${args.route}`;
  return args;
}

function bindingLimit(snapshot) {
  return snapshot?.limits?.find((limit) => limit.key === snapshot?.derived?.binding_limit_key)
    || snapshot?.limits?.find((limit) => limit.used_percent !== null)
    || null;
}

function usageSummary(snapshot) {
  const binding = bindingLimit(snapshot);
  return {
    observed_at: snapshot?.observed_at || null,
    model: snapshot?.codex?.model || null,
    reasoning_effort: snapshot?.codex?.reasoning_effort || null,
    binding_limit_key: binding?.key || null,
    used_percent: binding?.used_percent ?? null,
    remaining_percent: binding?.remaining_percent_derived ?? null,
    window_minutes: binding?.window_minutes ?? null,
    resets_at: binding?.resets_at || null,
    session_total_tokens: snapshot?.tokens?.session_cumulative?.total ?? null,
    last_event_tokens: snapshot?.tokens?.last_event?.total ?? null,
  };
}

function readJson(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function lensSummary(filePath) {
  const lens = readJson(filePath);
  if (!lens) return null;
  const extraction = lens.extraction || {};
  const compression = lens.compression || {};
  return {
    path: filePath,
    schema: lens.schema || null,
    source_file: lens.source?.filename || null,
    status: extraction.status || null,
    source_count: extraction.source_count ?? null,
    claim_count: extraction.claim_count ?? null,
    pages_read: extraction.pages_read ?? null,
    page_count: extraction.page_count ?? null,
    source_tokens: extraction.estimated_source_tokens ?? null,
    lens_tokens: compression.estimated_lens_tokens ?? null,
    ratio: compression.ratio ?? null,
  };
}

function trialPath(trial) {
  return path.join(outputDir, `${trial.replace(/[^a-z0-9_.-]+/giu, "-")}.json`);
}

function readTrial(trial) {
  const filePath = trialPath(trial);
  return readJson(filePath) || {
    schema: "theseus.lens_usage_trial.v1",
    trial,
    created_at: new Date().toISOString(),
    route: "",
    goal: "",
    marks: {},
  };
}

function writeTrial(trial) {
  mkdirSync(outputDir, { recursive: true });
  const filePath = trialPath(trial.trial);
  writeFileSync(filePath, `${JSON.stringify(trial, null, 2)}\n`, "utf8");
  appendFileSync(path.join(outputDir, `${new Date().toISOString().slice(0, 10)}.jsonl`), `${JSON.stringify(trial)}\n`, "utf8");
  writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(trial, null, 2)}\n`, "utf8");
  return filePath;
}

function delta(start, end) {
  if (!start || !end) return {};
  return {
    used_percent_delta:
      start.used_percent === null || end.used_percent === null
        ? null
        : Number((end.used_percent - start.used_percent).toFixed(3)),
    session_total_tokens_delta:
      start.session_total_tokens === null || end.session_total_tokens === null
        ? null
        : end.session_total_tokens - start.session_total_tokens,
  };
}

async function mark(args) {
  const { snapshot } = await collectUsageSnapshot({ workspace: repoRoot });
  const trial = readTrial(args.trial);
  trial.route = args.route || trial.route;
  trial.goal = args.goal || trial.goal;
  trial.updated_at = new Date().toISOString();
  trial.marks[args.command] = {
    at: new Date().toISOString(),
    note: args.note,
    quality: args.quality,
    usage: usageSummary(snapshot),
    lens: lensSummary(args.lens),
  };
  trial.delta = delta(trial.marks.start?.usage, trial.marks.end?.usage);
  const filePath = writeTrial(trial);
  await writeTimelineEvent(
    {
      source: "lens-usage-trial",
      event: `lens-usage-${args.command}`,
      note: `${trial.trial}; ${trial.route}; ${trial.delta?.used_percent_delta ?? "pending"} pp`,
      tags: ["lens-usage", trial.route, args.command],
      artifacts: [path.relative(repoRoot, filePath)],
      metrics: {
        used_percent_delta: trial.delta?.used_percent_delta ?? null,
        session_total_tokens_delta: trial.delta?.session_total_tokens_delta ?? null,
      },
    },
    { workspace: repoRoot },
  );
  return { ok: true, filePath, trial };
}

function report(args) {
  const trial = readTrial(args.trial);
  return {
    ok: Boolean(trial.marks.start || trial.marks.end),
    trial,
    summary: {
      route: trial.route,
      goal: trial.goal,
      start_used_percent: trial.marks.start?.usage?.used_percent ?? null,
      end_used_percent: trial.marks.end?.usage?.used_percent ?? null,
      used_percent_delta: trial.delta?.used_percent_delta ?? null,
      session_total_tokens_delta: trial.delta?.session_total_tokens_delta ?? null,
      lens_ratio: trial.marks.start?.lens?.ratio ?? trial.marks.end?.lens?.ratio ?? null,
      quality: trial.marks.end?.quality || "",
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = args.command === "report" ? report(args) : await mark(args);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export { delta, lensSummary, report, usageSummary };
