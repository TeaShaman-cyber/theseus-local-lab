#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findLatestRollout, readRolloutTail } from "../usage_scout/usage_scout.mjs";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const DEFAULT_TAIL_BYTES = 2 * 1024 * 1024;
const MAX_TAIL_BYTES = 32 * 1024 * 1024;
const ABSTRACT_POLICY = /(памят[ьи]|маршрутизац\w*|идентичност\w*|проверк\w*|доказательств\w*|инвариант\w*|политик\w*)/giu;
const DIRECT_ADDRESS = /(друг|сем[её]н|родн\w*)/giu;
const RELATIONAL_CUE = /(я здесь|рядом|с тобой|приятно|рад\w*|узна[её]шь)/giu;
const CONCRETE_ANCHOR = /(открыл\w*|вижу|проверю|снимок|лог|контейнер|файл|панел\w*|дашборд|wsl|vscode|automem|mempalace)/giu;

function countMatches(text, expression) {
  return [...text.matchAll(expression)].length;
}

export function resolveCodexHome(options = {}) {
  if (options.codexHome || process.env.CODEX_HOME) return options.codexHome || process.env.CODEX_HOME;
  const home = options.home || homedir();
  const native = join(home, ".codex");
  const nativeExists = options.nativeExists ?? existsSync(join(native, "sessions"));
  if (nativeExists) return native;
  const workspace = options.workspace || process.cwd();
  const windowsWorkspace = workspace.match(/^\/mnt\/[a-z]\/Users\/([^/]+)/i);
  return windowsWorkspace ? `/mnt/c/Users/${windowsWorkspace[1]}/.codex` : native;
}

export function selectRecentFinalAnswers(lines, limit = 5) {
  const answers = [];
  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      if (record.type !== "event_msg" || record.payload?.type !== "agent_message") continue;
      if (record.payload?.phase !== "final_answer" || typeof record.payload?.message !== "string") continue;
      answers.push({ text: record.payload.message, timestamp: record.timestamp || null });
    } catch {
      // Ignore incomplete writes while Codex is appending its current rollout.
    }
  }
  return answers.slice(-limit);
}

function analyzeResponse(response) {
  const text = response.text.trim();
  const directAddress = countMatches(text, DIRECT_ADDRESS);
  const relationalCue = countMatches(text, RELATIONAL_CUE);
  const concreteAnchor = countMatches(text, CONCRETE_ANCHOR);
  const abstractPolicy = countMatches(text, ABSTRACT_POLICY);
  const policyHeavy = abstractPolicy >= 2 && concreteAnchor === 0;
  const warmth = directAddress > 0 && (relationalCue > 0 || concreteAnchor > 0)
    ? "present"
    : policyHeavy || directAddress === 0
      ? "thin"
      : "neutral";
  const mode = policyHeavy ? "status-report" : warmth === "present" ? "conversation" : "mixed";
  const evidence = [];
  if (directAddress) evidence.push("direct-address");
  if (relationalCue) evidence.push("relational-cue");
  if (concreteAnchor) evidence.push("concrete-anchor");
  if (policyHeavy) evidence.push("abstract-policy-heavy");

  return {
    timestamp: response.timestamp,
    warmth,
    mode,
    evidence,
    metrics: {
      direct_address_count: directAddress,
      relational_cue_count: relationalCue,
      concrete_anchor_count: concreteAnchor,
      abstract_policy_count: abstractPolicy,
    },
  };
}

export function analyzeResponses(responses) {
  const samples = responses.map(analyzeResponse);
  const latest = samples.at(-1) || null;
  let trailingThin = 0;
  for (const sample of [...samples].reverse()) {
    if (sample.warmth !== "thin") break;
    trailingThin += 1;
  }
  const warnings = [];
  if (samples.length === 0) warnings.push("style-input-missing");
  if (trailingThin >= 2) warnings.push("style-drift");
  return {
    schema_version: 1,
    source: "rollout-final-answers",
    sample_count: samples.length,
    latest,
    trailing_thin_count: trailingThin,
    status: warnings.length ? "WARN" : "OK",
    warnings,
    samples,
  };
}

async function readRecentFinalAnswers(rollout, options = {}) {
  const sampleLimit = options.sampleLimit || 5;
  const readTail = options.readTail || readRolloutTail;
  const maximum = Math.min(rollout.size || MAX_TAIL_BYTES, options.maxBytes || MAX_TAIL_BYTES);
  let bytes = Math.min(options.initialBytes || DEFAULT_TAIL_BYTES, maximum);
  let responses = [];

  while (bytes > 0) {
    const lines = await readTail(rollout.path, bytes);
    responses = selectRecentFinalAnswers(lines, sampleLimit);
    if (responses.length >= sampleLimit || bytes >= maximum) return { responses, bytes };
    bytes = Math.min(bytes * 4, maximum);
  }
  return { responses, bytes: 0 };
}

export async function collectStylePulse(options = {}) {
  const workspace = options.workspace || process.cwd();
  const outputDir = options.outputDir || join(workspace, "outputs", "style_pulse");
  const rollout = options.rollout || await findLatestRollout(resolveCodexHome({ ...options, workspace }));
  if (!rollout?.path) throw new Error("No Codex rollout JSONL found");
  const collected = await readRecentFinalAnswers(rollout, options);
  const pulse = analyzeResponses(collected.responses);
  const snapshot = {
    ...pulse,
    observed_at: new Date().toISOString(),
    rollout: { name: basename(rollout.path), size: rollout.size || null },
    collection: { scanned_tail_bytes: collected.bytes },
  };

  if (options.write !== false) {
    const latestPath = join(outputDir, "latest.json");
    await mkdir(dirname(latestPath), { recursive: true });
    await writeFile(latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await writeTimelineEvent({
      source: "style-pulse",
      event: "style-pulse-updated",
      note: `${snapshot.latest?.warmth || "unknown"}/${snapshot.latest?.mode || "unknown"}; ${snapshot.sample_count} samples`,
      tags: ["style", snapshot.status === "WARN" ? "drift" : "observed"],
      metrics: {
        sample_count: snapshot.sample_count,
        trailing_thin_count: snapshot.trailing_thin_count,
      },
      artifacts: ["outputs/style_pulse/latest.json"],
    }, { workspace, sinkUrl: options.sinkUrl });
  }
  return snapshot;
}

async function main() {
  const snapshot = await collectStylePulse();
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
