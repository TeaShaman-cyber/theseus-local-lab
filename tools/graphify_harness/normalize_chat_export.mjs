#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") options.input = argv[++index];
    if (value === "--out") options.out = argv[++index];
    if (value === "--title") options.title = argv[++index];
  }
  if (!options.input || !options.out) {
    throw new Error("Usage: normalize_chat_export.mjs --input <chat.json> --out <corpus.md> [--title <title>]");
  }
  return options;
}

function redact(text) {
  return String(text)
    .replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[redacted-token]")
    .replace(/\b(?:Bearer\s+)[A-Za-z0-9._-]{16,}\b/gi, "Bearer [redacted-token]")
    .replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, "[redacted-private-key]");
}

function formatTimestamp(value) {
  if (!Number.isFinite(value)) return "unknown-time";
  return new Date(value * 1000).toISOString();
}

function visibleMessages(payload) {
  const messages = Array.isArray(payload.chat_messages) ? payload.chat_messages : [];
  return messages
    .filter((message) => typeof message?.content === "string" && message.content.trim())
    .map((message) => ({
      id: message.message_id ?? "unknown",
      parent_id: message.parent_id ?? null,
      role: message.role || "unknown",
      model: message.model || "unknown",
      inserted_at: formatTimestamp(message.inserted_at),
      content: redact(message.content.trim()),
      reasoning_trace: typeof message.thinking_content === "string" && message.thinking_content.trim()
        ? redact(message.thinking_content.trim())
        : null,
    }));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(readFileSync(options.input, "utf8"));
  const messages = visibleMessages(payload);
  const title = options.title || path.basename(options.input, path.extname(options.input));
  const lines = [
    `# ${title}`,
    "",
    "<!-- Generated locally from a user-provided chat export. Visible messages and separately labelled model reasoning traces are retained; service metadata is excluded. -->",
    "",
    `- Source file: ${path.basename(options.input)}`,
    `- Messages retained: ${messages.length}`,
    "- Provenance: user-provided local export",
    "",
  ];

  for (const message of messages) {
    lines.push(`## ${message.role} | ${message.inserted_at} | ${message.model} | message ${message.id}`);
    if (message.parent_id !== null) lines.push(`Parent: ${message.parent_id}`);
    lines.push("", message.content, "");
    if (message.reasoning_trace) {
      lines.push("### reasoning_trace (model-generated, source-specific, unverified)", "", message.reasoning_trace, "");
    }
  }

  mkdirSync(path.dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${lines.join("\n")}\n`);
  console.log(JSON.stringify({
    status: "ok",
    input: path.basename(options.input),
    output: options.out,
    retained_messages: messages.length,
    retained_layers: ["visible_message", "reasoning_trace"],
    omitted_fields: ["accumulated_token_usage", "files", "feedback", "search_results", "tips"],
  }));
}

main();
