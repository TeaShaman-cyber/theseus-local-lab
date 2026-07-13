#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";

import { classifyText, renderMarkdown, summarize } from "./harness_errors.mjs";

test("classifies web_search_call reasoning replay mismatch", () => {
  const matches = classifyText(
    "Item 'ws_123' of type 'web_search_call' was provided without its required 'reasoning' item: 'rs_456'.",
    "chat.log",
  );

  assert.equal(matches[0].id, "harness-history-replay");
  assert.equal(matches[0].category, "codex-harness");
});

test("classifies Windows socket permission errors", () => {
  const matches = classifyText(
    "URLError: <urlopen error [WinError 10013] Сделана попытка доступа к сокету методом, запрещенным правами доступа>",
    "state.md",
  );

  assert.equal(matches[0].id, "windows-sandbox-socket");
});

test("classifies TLS handshake timeouts", () => {
  const matches = classifyText("URLError: <urlopen error _ssl.c:993: The handshake operation timed out>", "state.md");

  assert.equal(matches[0].id, "proxy-network-timeout");
});

test("classifies ephemeral local file errors", () => {
  const matches = classifyText(
    "Codex could not read the local image at C:\\Temp\\codex-clipboard-abc.png: No such file or directory (os error 2)",
    "chat.md",
  );

  assert.equal(matches[0].id, "ephemeral-local-file");
});

test("summarizes and renders markdown", () => {
  const summary = summarize([
    { id: "windows-sandbox-socket", category: "windows-network" },
    { id: "windows-sandbox-socket", category: "windows-network" },
    { id: "proxy-network-timeout", category: "network-proxy" },
  ]);
  const markdown = renderMarkdown(summary);

  assert.equal(summary.by_id["windows-sandbox-socket"], 2);
  assert.match(markdown, /Harness Error Report/);
  assert.match(markdown, /network-proxy: 1/);
});
