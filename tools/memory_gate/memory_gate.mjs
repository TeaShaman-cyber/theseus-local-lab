#!/usr/bin/env node

import { createHash } from "node:crypto";

const input = JSON.parse(await new Promise((resolve) => { let s=""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => resolve(s || "{}")); }));
const text = String(input.prompt || input.summary || input.message || "").trim();
const durable = /\b(decision|decided|root cause|validated|fixed|fix|architecture|checkpoint|handoff|предпочитаю|решили|исправил|причина)\b/i.test(text);
const secret = /(api[_-]?key|token|password|secret|bearer\s+[a-z0-9._-]+)/i.test(text);
const eventId = createHash("sha256").update(`${input.session_id || "unknown"}|${text}`).digest("hex").slice(0, 24);
process.stdout.write(JSON.stringify({ accept: durable && !secret && text.length <= 4000, event_id: eventId, durable_signal: durable, privacy_safe: !secret, semantic: durable && !secret, episodic: durable && !secret, content: text.slice(0, 4000) }));
