#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  containsCredentialMaterial,
  extractTranscriptContent,
  redactSensitiveText,
} from "../tools/memory_gate/text_safety.mjs";

const event = process.argv[2] || "";

async function readHookInput() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

const input = await readHookInput();
const baseUrl = (process.env.HINDSIGHT_API_URL || "http://127.0.0.1:8888").replace(/\/$/, "");
const bankId = process.env.HINDSIGHT_BANK_ID || "codex";
const timeoutMs = Number(process.env.HINDSIGHT_HOOK_TIMEOUT_MS || 5000);

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function emitContext(text) {
  if (!text) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text } }));
}

async function recall() {
  const query = String(input.prompt || "").trim();
  if (query.length < 5) return;
  const response = await request(`/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, max_tokens: 1024, budget: "mid", types: ["world", "experience", "observation"] }),
  });
  if (!response.ok) return;
  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (!results.length) return;
  const lines = results.slice(0, 8).map((item) => `- ${item.text || item.content || item.memory || ""}`.trim()).filter((line) => line.length > 2);
  if (lines.length) emitContext(`<hindsight_memories>\n${lines.join("\n")}\n</hindsight_memories>`);
}

async function retain() {
  const transcriptPath = input.transcript_path;
  if (!transcriptPath) return;
  const rawContent = await readFile(transcriptPath, "utf8").catch(() => "");
  const transcriptContent = extractTranscriptContent(rawContent);
  if (containsCredentialMaterial(transcriptContent)) return;
  const content = redactSensitiveText(transcriptContent).trim().slice(-4000);
  if (!content.trim()) return;
  const documentId = String(input.session_id || input.turn_id || `codex-${Date.now()}`);
  await request(`/v1/default/banks/${encodeURIComponent(bankId)}/memories`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ async: true, items: [{ document_id: documentId, content, context: "Codex engineering session", metadata: { source: "codex" } }] }),
  });
}

try {
  if (event === "UserPromptSubmit") await recall();
  if (event === "Stop") await retain();
} catch (error) {
  process.stderr.write(`[Hindsight] ${error?.message || "memory hook failed softly"}\n`);
}
process.exit(0);
