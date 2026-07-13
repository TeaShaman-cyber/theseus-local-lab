#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cwd } from "node:process";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const VALID_MODES = new Set(["checkpoint", "compact", "handoff"]);

function parseArgs(argv) {
  const args = {
    mode: "checkpoint",
    summary: "",
    goal: "",
    raw: "",
    tags: [],
    decisions: [],
    openLoops: [],
    changedFiles: [],
    nextActions: [],
    audience: "",
    stdin: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1] || "";
    if (value === "--mode") {
      args.mode = next;
      index += 1;
    } else if (value === "--summary") {
      args.summary = next;
      index += 1;
    } else if (value === "--goal") {
      args.goal = next;
      index += 1;
    } else if (value === "--raw") {
      args.raw = next;
      index += 1;
    } else if (value === "--tag") {
      if (next) args.tags.push(next);
      index += 1;
    } else if (value === "--tags") {
      args.tags.push(...splitList(next));
      index += 1;
    } else if (value === "--decision") {
      if (next) args.decisions.push(next);
      index += 1;
    } else if (value === "--open-loop") {
      if (next) args.openLoops.push(next);
      index += 1;
    } else if (value === "--changed-file") {
      if (next) args.changedFiles.push(next);
      index += 1;
    } else if (value === "--next-action") {
      if (next) args.nextActions.push(next);
      index += 1;
    } else if (value === "--audience") {
      args.audience = next;
      index += 1;
    } else if (value === "--stdin") {
      args.stdin = true;
    }
  }

  return args;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function redact(text) {
  return String(text || "")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]+?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
}

function readStdin(enabled) {
  if (!enabled) return "";
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function slugify(text) {
  const slug = String(text || "memory-hook")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "memory-hook";
}

function uniq(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function bullet(items) {
  return items.length ? items.map((item) => `- ${item}`) : ["- (none)"];
}

function buildPacket(event, automemDraft) {
  const lines = [
    `# ${event.mode === "handoff" ? "Handoff" : "Compact"} State Packet`,
    "",
    `Created: ${event.created_at}`,
    `Mode: ${event.mode}`,
    `Event ID: ${event.id}`,
    "",
    "## Summary",
    "",
    event.summary,
    "",
    "## Goal",
    "",
    event.goal || "(not specified)",
    "",
    "## Decisions",
    "",
    ...bullet(event.decisions),
    "",
    "## Open Loops",
    "",
    ...bullet(event.open_loops),
    "",
    "## Changed Files",
    "",
    ...bullet(event.changed_files),
    "",
    "## Next Actions",
    "",
    ...bullet(event.next_actions),
    "",
    "## Memory Refs",
    "",
    `- Raw event: ${event.raw_event_path}`,
    `- AutoMem draft: ${automemDraft.path}`,
    "",
  ];

  if (event.mode === "handoff") {
    lines.splice(6, 0, "## Audience", "", event.audience || "another agent/model", "");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!VALID_MODES.has(args.mode)) {
    console.error(`Invalid mode: ${args.mode}. Use checkpoint, compact, or handoff.`);
    process.exit(2);
  }

  const now = new Date();
  const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "-");
  const id = `${stamp}-${Math.random().toString(16).slice(2, 8)}`;
  const workspace = cwd();
  const summary = redact(args.summary || args.raw || "Theseus memory hook event").slice(0, 500);
  const rawInput = redact(`${args.raw}${args.stdin ? `\n${readStdin(true)}` : ""}`).slice(0, 12_000);
  const tags = uniq(["theseus-local-lab", "memory-hook", args.mode, ...args.tags]);

  const rawDir = join(workspace, "outputs", "memory_hook");
  const inboxDir = join(workspace, "outputs", "memory_inbox");
  const packetDir = join(workspace, "outputs", "state_packets");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(inboxDir, { recursive: true });
  mkdirSync(packetDir, { recursive: true });

  const rawEventPath = join(rawDir, `${now.toISOString().slice(0, 10)}.jsonl`);
  const event = {
    id,
    created_at: now.toISOString(),
    mode: args.mode,
    workspace,
    summary,
    goal: redact(args.goal).slice(0, 500),
    decisions: args.decisions.map((item) => redact(item).slice(0, 500)),
    open_loops: args.openLoops.map((item) => redact(item).slice(0, 500)),
    changed_files: args.changedFiles.map((item) => redact(item).slice(0, 300)),
    next_actions: args.nextActions.map((item) => redact(item).slice(0, 500)),
    audience: redact(args.audience).slice(0, 300),
    tags,
    raw_excerpt: rawInput,
    raw_event_path: rawEventPath,
  };

  writeFileSync(rawEventPath, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });

  const contentParts = [
    `Memory hook ${args.mode}.`,
    summary,
    event.goal ? `Goal: ${event.goal}.` : "",
    event.open_loops.length ? `Open loops: ${event.open_loops.join("; ")}.` : "",
  ].filter(Boolean);

  const automemDraft = {
    path: "",
    automem: {
      content: contentParts.join(" ").slice(0, 900),
      tags,
      importance: args.mode === "compact" ? 0.88 : args.mode === "handoff" ? 0.84 : 0.76,
      type: args.mode === "checkpoint" ? "Context" : "Decision",
      metadata: {
        memory_hook_event_id: id,
        mode: args.mode,
        raw_event_path: rawEventPath,
        changed_files: event.changed_files,
      },
    },
  };

  const draftPath = join(inboxDir, `${stamp}-${args.mode}-${slugify(summary)}.json`);
  automemDraft.path = draftPath;
  writeFileSync(draftPath, `${JSON.stringify(automemDraft.automem, null, 2)}\n`, "utf8");

  let packetPath = "";
  if (args.mode === "compact" || args.mode === "handoff") {
    packetPath = join(packetDir, `${stamp}-${args.mode}-${slugify(summary)}.md`);
    writeFileSync(packetPath, buildPacket(event, automemDraft), "utf8");
  }

  await writeTimelineEvent(
    {
      source: "memory-hook",
      event: args.mode === "checkpoint" ? "memory-checkpoint" : "context-compaction",
      note: summary,
      tags,
      artifacts: [rawEventPath, draftPath, packetPath].filter(Boolean).map((item) => basename(item)),
      metrics: {
        decisions: event.decisions.length,
        open_loops: event.open_loops.length,
        changed_files: event.changed_files.length,
      },
    },
    { workspace },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        id,
        mode: args.mode,
        raw_event_path: rawEventPath,
        automem_draft_path: draftPath,
        packet_path: packetPath,
        tags,
      },
      null,
      2,
    ),
  );
}

await main();
