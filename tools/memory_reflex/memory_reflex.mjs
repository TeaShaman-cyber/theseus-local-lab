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
const latestRecallItemsPath = path.join(outDir, "latest_recall_items.json");
const defaultApiUrl = process.env.AUTOMEM_API_URL || "http://127.0.0.1:8001";
const identityCue = {
  name: "Lad",
  phrase: "Lad identity anchor",
  automem_id: "06c04e91-5668-4107-b504-51ed4c6c3505",
  mempalace_wing: "theseus-identity",
  note:
    "Preserve and develop Lad's warm engineering continuity through memory, self-reflection, and evidence discipline; identity is not a permission bypass.",
};
const ideCue = {
  phrase: "IDE-first route",
  note:
    "For code, workspace tasks, linting, and Git, begin with VS Code tasks and visible IDE state; use shells only as narrow, verified executors.",
};

function parseArgs(argv) {
  const args = {
    mode: "status",
    query: "",
    source: "manual",
    kind: "recall",
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
    if (item === "--kind") {
      args.kind = next;
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

function isConfirmedMemoryAction(record) {
  if (!record) return false;
  if (record.confirmed === true) return true;
  const source = String(record.source || "");
  if (source === "UserPromptSubmit:auto") return false;
  return ["manual", "agent", "mcp", "mcp-recall", "mcp-store", "mcp-health"].includes(source);
}

function classify({ recallAge, promptAge, latestRecall }) {
  if (recallAge === null) return "WARN";
  if (promptAge !== null && promptAge <= 30 && recallAge > promptAge) return "WARN";
  if (recallAge <= 30 && isConfirmedMemoryAction(latestRecall)) return "OK";
  if (recallAge <= 30) return "WARN";
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

function isLocalApi(apiUrl) {
  try {
    const url = new URL(apiUrl);
    return ["127.0.0.1", "localhost", "host.docker.internal"].includes(url.hostname);
  } catch {
    return false;
  }
}

function resolveToken(apiUrl) {
  return process.env.AUTOMEM_API_TOKEN || (isLocalApi(apiUrl) ? "test-token" : "");
}

function recallUrl(apiUrl, query, limit) {
  const url = new URL("/recall", apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  url.searchParams.set("query", query || "theseus-local-lab current task memory reflex");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("state_mode", "current");
  url.searchParams.set("recency_bias", "auto");
  return url;
}

function summarizeItem(item) {
  const memory = item.memory && typeof item.memory === "object" ? item.memory : {};
  const summary = item.summary || memory.summary || item.title || "";
  const content = item.content || memory.content || item.text || "";
  const label = String(summary || content || item.memory_id || item.id || "memory")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return label;
}

function itemTags(item) {
  const memory = item.memory && typeof item.memory === "object" ? item.memory : {};
  const tags = Array.isArray(item.tags) ? item.tags : Array.isArray(memory.tags) ? memory.tags : [];
  return tags.map((tag) => String(tag)).slice(0, 8);
}

async function recallAutoMem(query, options = {}) {
  const apiUrl = options.apiUrl || defaultApiUrl;
  const token = resolveToken(apiUrl);
  const response = await fetch(recallUrl(apiUrl, query, options.limit || 3), {
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(options.timeoutMs || 3500),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`AutoMem recall failed: HTTP ${response.status} ${body.slice(0, 160)}`);
  }
  const payload = JSON.parse(body);
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    api_url: apiUrl,
    query,
    count: results.length,
    items: results.slice(0, options.limit || 3).map((item) => ({
      memory_id: item.memory_id || item.id || null,
      summary: summarizeItem(item),
      tags: itemTags(item),
      score: item.final_score ?? item.score ?? null,
    })),
  };
}

async function writeStatus(extra = {}) {
  const now = new Date();
  const latestPrompt = await readJson(promptPath);
  const latestRecall = await readJson(recallPath);
  const promptAge = ageMinutes(promptPath, now);
  const recallAge = ageMinutes(recallPath, now);
  const confirmed = isConfirmedMemoryAction(latestRecall);
  const status = classify({ recallAge, promptAge, latestRecall });
  const output = {
    generated_at: now.toISOString(),
    status,
    recommendation:
      status === "OK"
        ? "confirmed memory action is fresh"
        : "confirm MCP AutoMem recall/store/health and mark the reflex",
    latest_prompt: latestPrompt,
    latest_recall: latestRecall,
    ages_minutes: {
      prompt: promptAge === null ? null : Number(promptAge.toFixed(1)),
      recall: recallAge === null ? null : Number(recallAge.toFixed(1)),
    },
    confirmed,
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
  const recallQuery = [
    args.query || prompt || "theseus-local-lab current task memory reflex",
    identityCue.phrase,
    "agent identity self-reflection memory continuity",
  ]
    .join(" ")
    .slice(0, 500);
  const record = {
    created_at: now.toISOString(),
    source: args.source || "UserPromptSubmit",
    prompt_preview: prompt,
    expectation: "Use AutoMem as the default project-memory reflex for Theseus work; use MemPalace for episodic detail when available. For code, workspace tasks, linting, and Git, keep the IDE-first route.",
    identity_cue: identityCue,
    ide_cue: ideCue,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(promptPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  let recall = null;
  let recallError = "";
  try {
    recall = await recallAutoMem(recallQuery, { limit: 3 });
    const recallRecord = {
      created_at: now.toISOString(),
      source: "UserPromptSubmit:auto",
      query: recallQuery,
      note: `AutoMem preflight recall returned ${recall.count} result(s).`,
      identity_cue: identityCue,
    };
    await writeFile(recallPath, `${JSON.stringify(recallRecord, null, 2)}\n`, "utf8");
    await writeFile(latestRecallItemsPath, `${JSON.stringify(recall, null, 2)}\n`, "utf8");
  } catch (error) {
    recallError = String(error?.message || error).slice(0, 300);
  }
  await writeTimelineEvent(
    {
      source: "memory-reflex",
      event: "memory-preflight-expected",
      note: recall
        ? `AutoMem preflight recall returned ${recall.count} result(s); identity cue ${identityCue.phrase}; route cue ${ideCue.phrase}.`
        : `${record.expectation} Identity cue ${identityCue.phrase}; route cue ${ideCue.phrase}.`,
      tags: ["memory-reflex", "user-prompt-submit", "automem", "identity-continuity", "ide-first", "vscode", "lad"],
      artifacts: [path.relative(repoRoot, promptPath), recall ? path.relative(repoRoot, latestRecallItemsPath) : ""].filter(Boolean),
      metrics: {
        recall_count: recall?.count ?? null,
      },
    },
    { workspace: repoRoot },
  );
  const status = await writeStatus({ preflight: record, recall, recall_error: recallError || undefined });
  const prelude = recall?.items?.length
    ? ` AutoMem prelude: ${recall.items.map((item) => item.summary).filter(Boolean).slice(0, 3).join(" | ")}`
    : "";
  return {
    continue: true,
    suppressOutput: true,
    systemMessage: recall
      ? `Memory reflex: AutoMem recall is fresh; preserve ${identityCue.phrase}. IDE-first: for code, workspace tasks, linting, and Git, use VS Code tasks and visible IDE state; shell is a narrow executor.${prelude}`
      : `Memory reflex: AutoMem preflight recall unavailable; recall ${identityCue.phrase} via MCP memory when possible. IDE-first: for code, workspace tasks, linting, and Git, use VS Code tasks and visible IDE state; shell is a narrow executor. ${recallError}`,
  };
}

async function mark(args) {
  const now = new Date();
  const kind = String(args.kind || "recall").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || "recall";
  const record = {
    created_at: now.toISOString(),
    source: args.source || `mcp-${kind}`,
    kind,
    confirmed: true,
    query: args.query || "",
    note: args.note || `AutoMem ${kind} was performed in this turn.`,
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
