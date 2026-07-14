#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLens, extractTextFile, slugFor } from "./ocr_lens.mjs";

test("builds a compact text-ready lens from extracted PDF pages", () => {
  const extraction = {
    ok: true,
    method: "pypdf",
    page_count: 2,
    pages: [
      { page: 1, method: "pypdf", chars: 120, text: "Introduction\nThis is a compact page with https://example.com/source." },
      { page: 2, method: "pypdf", chars: 90, text: "2 Method\nSecond page text with enough content for coverage." },
    ],
  };

  const { lens, markdown } = buildLens({
    inputPath: "C:/docs/sample.pdf",
    digest: "a".repeat(64),
    size: 1234,
    extraction,
    options: { maxTotalChars: 2000, maxPageChars: 400 },
  });

  assert.equal(lens.extraction.status, "text_ready");
  assert.equal(lens.extraction.page_count, 2);
  assert.equal(lens.links[0].url, "https://example.com/source");
  assert.match(markdown, /Page 1/);
});

test("marks image-only or scanned documents as needing an OCR backend", () => {
  const extraction = {
    ok: false,
    method: null,
    page_count: 2,
    pages: [
      { page: 1, method: null, chars: 0, text: "" },
      { page: 2, method: null, chars: 0, text: "" },
    ],
  };

  const { lens, markdown } = buildLens({
    inputPath: "C:/docs/scan.pdf",
    digest: "b".repeat(64),
    size: 1234,
    extraction,
    options: { maxTotalChars: 2000, maxPageChars: 400 },
  });

  assert.equal(lens.extraction.status, "needs_ocr_backend");
  assert.match(markdown, /Use an OCR backend/);
});

test("slug keeps readable names and a digest prefix", () => {
  assert.equal(slugFor("C:/Docs/Краткое резюме.pdf", "abcdef123456"), "краткое-резюме-abcdef1234");
});

test("extracts a lightweight lens source from Markdown or text sidecars", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "theseus-ocr-lens-"));
  const filePath = path.join(dir, "notes.md");
  try {
    writeFileSync(
      filePath,
      '# Observatory\n\nThis Markdown sidecar gives Codex a cheaper route than reading a scanned PDF again.\n\n<img src="https://example.com/observatory">',
      "utf8",
    );
    const extraction = extractTextFile(filePath, 240);
    const { lens } = buildLens({
      inputPath: filePath,
      digest: "c".repeat(64),
      size: 120,
      extraction,
      options: { maxTotalChars: 2000, maxPageChars: 400 },
    });

    assert.equal(lens.extraction.status, "text_ready");
    assert.equal(lens.extraction.method, "text-file");
    assert.equal(lens.headings[0].text, "# Observatory");
    assert.equal(lens.links[0].url, "https://example.com/observatory");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
