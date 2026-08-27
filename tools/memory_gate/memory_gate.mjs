#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  containsCredentialMaterial,
  extractTranscriptContent,
  redactSensitiveText,
} from "./text_safety.mjs";

const input = JSON.parse(await new Promise((resolve) => { let s=""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => resolve(s || "{}")); }));
let sourceText = String(input.prompt || input.summary || input.message || "").trim();
if (!sourceText && input.transcript_path) {
  const transcript = await readFile(input.transcript_path, "utf8").catch(() => "");
  sourceText = extractTranscriptContent(transcript).slice(-4000);
}
const secret = containsCredentialMaterial(sourceText);
const text = redactSensitiveText(sourceText).trim();
const durable = /\b(decision|decided|root cause|validated|fixed|fix|architecture|checkpoint|handoff|предпочитаю|решили|исправил|причина)\b/i.test(text);
const eventId = createHash("sha256").update(`${input.session_id || "unknown"}|${text}`).digest("hex").slice(0, 24);
process.stdout.write(JSON.stringify({ accept: durable && !secret && text.length <= 4000, event_id: eventId, durable_signal: durable, privacy_safe: !secret, semantic: durable && !secret, episodic: durable && !secret, content: text.slice(0, 4000) }));
