#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";

import { buildMemoryDraft, buildSourceLens, parseJsonSources, parseTextSources } from "./source_lens.mjs";

test("extracts ranked sources from search-result shaped JSON", () => {
  const raw = JSON.stringify({
    query: "codex usage limits",
    results: [
      {
        title: "Codex usage dashboard docs",
        url: "https://learn.chatgpt.com/codex/usage",
        snippet: "Official docs explain usage limits, credits, speed modes, and dashboard signals.",
      },
      {
        title: "Community report",
        url: "https://www.reddit.com/r/codex/example",
        snippet: "A user reports provider capacity failures and confusing reset behavior.",
      },
    ],
  });

  const { lens, markdown } = buildSourceLens({
    inputPath: "C:/tmp/results.json",
    raw,
    digest: "a".repeat(64),
    size: raw.length,
    options: { query: "codex usage limits", maxItems: 10 },
  });

  assert.equal(lens.extraction.status, "lens_ready");
  assert.equal(lens.sources[0].source_type, "docs");
  assert.match(markdown, /Reading Route/);
});

test("extracts headings, links, and claims from Markdown page text", () => {
  const raw = [
    "# Codex Windows Diagnostics",
    "",
    "Codex should preserve provider failure events because usage limits and model capacity failures affect routing decisions.",
    "",
    "See https://github.com/openai/codex/issues for related issues.",
  ].join("\n");

  const parsed = parseTextSources(raw);
  assert.equal(parsed.headings[0], "# Codex Windows Diagnostics");
  assert.equal(parsed.links[0], "https://github.com/openai/codex/issues");
  assert.equal(parsed.claims.length, 1);
});

test("builds an AutoMem-compatible draft without storing automatically", () => {
  const raw = JSON.stringify({
    title: "DeepSeek-OCR-2",
    url: "https://github.com/deepseek-ai/DeepSeek-OCR-2",
    snippet: "Visual causal flow suggests semantic token reordering before deep reading.",
  });
  const { lens } = buildSourceLens({
    inputPath: "C:/tmp/source.json",
    raw,
    digest: "b".repeat(64),
    size: raw.length,
    options: { query: "DeepSeek OCR source lens", maxItems: 10 },
  });
  const draft = buildMemoryDraft(lens, { markdownPath: "outputs/source_lens/source.md" });

  assert.equal(draft.type, "Context");
  assert.ok(draft.tags.includes("source-lens"));
  assert.match(draft.content, /Reading route/);
  assert.equal(draft.metadata.source_file, "source.json");
});

test("parses JSONL best-effort", () => {
  const sources = parseJsonSources([
    JSON.stringify({ title: "Paper", url: "https://arxiv.org/abs/2601.20552", snippet: "DeepSeek-OCR-2 paper." }),
    "{not json}",
    JSON.stringify({ title: "Repo", url: "https://github.com/deepseek-ai/DeepSeek-OCR-2" }),
  ].join("\n"));

  assert.equal(sources.length, 2);
  assert.equal(sources[0].source_type, "paper");
});
