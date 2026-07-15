#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.join(repoRoot, "outputs", "memory_reflex");
const promptPath = path.join(outDir, "latest_prompt.json");
const recallPath = path.join(outDir, "latest_recall.json");
const statusPath = path.join(outDir, "latest.json");

function parseArgs(argv) {
  const args = {
    mode: "status",
    query: "",
    source: "manual",
    note: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1] || "";
    if (item === "preflight" || item === "mark" || item === "status") args.mode = item;
    if (item === "--query") {
      args.query = next;
      index += 1;
    }
    if (item === "--source") {
      args.source = next;
      index += 1;
    }
    if (item === "--note") {
      args.note = next;
      index += 1;
    }
  }

  return args;
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ageMinutes(filePath, now = new Date()) {
  if (!existsSync(filePath)) return null;
  return Math.max(0, (now.getTime() - statSync(filePath).mtime.getTime()) / 60_000);
}

function classify({ recallAge, promptAge }) {
  if (recallAge === null) return "WARN";
  if (recallAge <= 30) return "OK";
  if (promptAge !== null && promptAge <= 30 && recallAge > promptAge) return "WARN";
  if (recallAge <= 180) return "WARN";
  return "FAIL";
}

function shortPrompt(payload, raw) {
  const candidates = [
    payload.prompt,
    payload.user_prompt,
    payload.message,
    payload.input,
    payload.text,
    raw,
  ];
  const text = candidates.find((value) => typeof value === "string" && value.trim()) || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function writeStatus(extra = {}) {
  const now = new Date();
  const latestPrompt = await readJson(promptPath);
  const latestRecall = await readJson(recallPath);
  const promptAge = ageMinutes(promptPath, now);
  const recallAge = ageMinutes(recallPath, now);
  const status = classify({ recallAge, promptAge });
  const output = {
    generated_at: now.toISOString(),
    status,
    recommendation:
      status === "OK"
        ? "memory recall is fresh"
        : "run AutoMem recall before non-trivial reasoning and mark the reflex",
    latest_prompt: latestPrompt,
    latest_recall: latestRecall,
    ages_minutes: {
      prompt: promptAge === null ? null : Number(promptAge.toFixed(1)),
      recall: recallAge === null ? null : Number(recallAge.toFixed(1)),
    },
    ...extra,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(statusPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

async function preflight(args, rawInput) {
  const now = new Date();
  const payload = tryParseJson(rawInput);
  const prompt = shortPrompt(payload, rawInput);
  const record = {
    created_at: now.toISOString(),
    source: args.source || "UserPromptSubmit",
    prompt_preview: prompt,
    expectation: "For non-trivial Theseus work, call AutoMem health/recall before reasoning; use MemPalace for episodic detail when available.",
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(promptPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await writeTimelineEvent(
    {
      source: "memory-reflex",
      event: "memory-preflight-expected",
      note: record.expectation,
      tags: ["memory-reflex", "user-prompt-submit", "automem"],
      artifacts: [path.relative(repoRoot, promptPath)],
    },
    { workspace: repoRoot },
  );
  const status = await writeStatus({ preflight: record });
  return {
    continue: true,
    suppressOutput: true,
    systemMessage:
      status.status === "OK"
        ? "Memory reflex: AutoMem recall is fresh."
        : "Memory reflex: for non-trivial work, call AutoMem health/recall before reasoning, then mark memory_reflex.",
  };
}

async function mark(args) {
  const now = new Date();
  const record = {
    created_at: now.toISOString(),
    source: args.source || "agent",
    query: args.query || "",
    note: args.note || "AutoMem recall was performed in this turn.",
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(recallPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await writeTimelineEvent(
    {
      source: "memory-reflex",
      event: "automem-recall-marked",
      note: record.note,
      tags: ["memory-reflex", "automem", "recall"],
      artifacts: [path.relative(repoRoot, recallPath)],
    },
    { workspace: repoRoot },
  );
  return writeStatus({ marked: record });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "preflight") {
    const raw = await readStdin();
    console.log(JSON.stringify(await preflight(args, raw)));
    return;
  }
  if (args.mode === "mark") {
    console.log(JSON.stringify(await mark(args), null, 2));
    return;
  }
  console.log(JSON.stringify(await writeStatus(), null, 2));
}

await main();
