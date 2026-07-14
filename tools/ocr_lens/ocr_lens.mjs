#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProgressReporter } from "../progress/progress.mjs";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "ocr_lens");
const bundledPython = path.join(
  os.homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe",
);
const extractorPath = path.join(import.meta.dirname, "extract_pdf.py");

function parseArgs(argv) {
  const args = {
    command: "lens",
    input: "",
    write: false,
    format: "markdown",
    maxPages: 0,
    maxPageChars: 700,
    maxTotalChars: 9000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "lens" || item === "doctor") args.command = item;
    else if (item === "--input") args.input = argv[++i] || "";
    else if (item === "--write") args.write = true;
    else if (item === "--json") args.format = "json";
    else if (item === "--markdown") args.format = "markdown";
    else if (item === "--max-pages") args.maxPages = Number(argv[++i] || 0);
    else if (item === "--max-page-chars") args.maxPageChars = Number(argv[++i] || args.maxPageChars);
    else if (item === "--max-total-chars") args.maxTotalChars = Number(argv[++i] || args.maxTotalChars);
    else if (!item.startsWith("--") && !args.input) args.input = item;
  }

  args.maxPages = clamp(args.maxPages, 0, 500, 0);
  args.maxPageChars = clamp(args.maxPageChars, 120, 3000, 700);
  args.maxTotalChars = clamp(args.maxTotalChars, 1000, 60000, 9000);
  return args;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd || repoRoot,
        env: options.env || process.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ ok: false, code: null, stdout: "", stderr: error.message });
      return;
    }

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs || 45_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function shortHash(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function slugFor(filePath, digest) {
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const safe = base.replace(/[^a-z0-9а-яё_-]+/giu, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "document";
  return `${safe}-${digest.slice(0, 10)}`;
}

function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function compactSnippet(text, maxChars) {
  const clean = cleanText(text);
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const boundary = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
  return `${slice.slice(0, boundary > maxChars * 0.55 ? boundary : maxChars).trim()} [...]`;
}

function extractHeadings(pages, limit = 40) {
  const headings = [];
  for (const page of pages) {
    const lines = cleanText(page.text).split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 4 || trimmed.length > 140) continue;
      if (/^(#{1,6}\s|[0-9]+(\.[0-9]+)*\s+|[A-ZА-ЯЁ][^.!?]{4,80}$)/u.test(trimmed)) {
        headings.push({ page: page.page, text: trimmed });
      }
      if (headings.length >= limit) return headings;
    }
  }
  return headings;
}

function extractLinks(pages, limit = 30) {
  const links = [];
  const seen = new Set();
  for (const page of pages) {
    for (const match of cleanText(page.text).matchAll(/https?:\/\/[^\s)>\]]+/g)) {
      const url = match[0].replace(/[.,;:"']+$/g, "");
      if (seen.has(url)) continue;
      seen.add(url);
      links.push({ page: page.page, url });
      if (links.length >= limit) return links;
    }
  }
  return links;
}

function extractTextFile(inputPath, maxPageChars) {
  const text = cleanText(readFileSync(inputPath, "utf8"));
  if (!text) {
    return {
      ok: false,
      method: "text-file",
      page_count: 0,
      pages: [],
      attempts: [{ method: "text-file", ok: false, error: "Text file is empty." }],
    };
  }

  const paragraphs = text.split(/\n{2,}/);
  const pages = [];
  let buffer = "";
  let lineStart = 1;
  let currentLine = 1;
  const targetChars = Math.max(800, maxPageChars * 4);

  for (const paragraph of paragraphs) {
    const lineCount = paragraph.split("\n").length + 1;
    if (buffer && buffer.length + paragraph.length > targetChars) {
      pages.push({
        page: pages.length + 1,
        method: "text-file",
        chars: buffer.length,
        line_start: lineStart,
        line_end: currentLine - 1,
        text: buffer,
      });
      buffer = "";
      lineStart = currentLine;
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    currentLine += lineCount;
  }
  if (buffer) {
    pages.push({
      page: pages.length + 1,
      method: "text-file",
      chars: buffer.length,
      line_start: lineStart,
      line_end: currentLine - 1,
      text: buffer,
    });
  }

  return {
    ok: true,
    method: "text-file",
    page_count: pages.length,
    pages,
    attempts: [{ method: "text-file", ok: true }],
  };
}

function buildLens({ inputPath, digest, size, extraction, options }) {
  const pages = extraction.pages || [];
  const totalChars = pages.reduce((sum, page) => sum + (page.chars || cleanText(page.text).length), 0);
  const textPages = pages.filter((page) => cleanText(page.text).length >= 30).length;
  const emptyPages = pages.filter((page) => cleanText(page.text).length < 30).map((page) => page.page);
  const pageCount = extraction.page_count || pages.length;
  const textCoverage = pageCount ? Number((textPages / pageCount).toFixed(3)) : 0;
  const status = totalChars === 0 ? "needs_ocr_backend" : textCoverage < 0.7 ? "partial_text" : "text_ready";
  const warnings = [];
  if (emptyPages.length) warnings.push(`${emptyPages.length} pages have little or no extractable text`);
  if (status === "needs_ocr_backend") warnings.push("Use an OCR backend for scanned/image-only pages");
  if (pages.length < pageCount) warnings.push(`Only ${pages.length} of ${pageCount} pages were read`);

  const pageCards = [];
  let budget = options.maxTotalChars;
  for (const page of pages) {
    if (budget <= 0) break;
    const snippet = compactSnippet(page.text, Math.min(options.maxPageChars, budget));
    budget -= snippet.length;
    pageCards.push({
      page: page.page,
      chars: page.chars || cleanText(page.text).length,
      method: page.method,
      snippet,
    });
  }

  const lens = {
    schema: "theseus.ocr_lens.v1",
    generated_at: new Date().toISOString(),
    source: {
      path: inputPath,
      filename: path.basename(inputPath),
      size,
      sha256: digest,
      extension: path.extname(inputPath).toLowerCase(),
    },
    extraction: {
      ok: Boolean(extraction.ok),
      method: extraction.method || null,
      attempts: extraction.attempts || [],
      page_count: pageCount,
      pages_read: pages.length,
      total_chars: totalChars,
      estimated_source_tokens: estimateTokens(totalChars),
      text_coverage: textCoverage,
      status,
      warnings,
    },
    compression: {
      max_total_chars: options.maxTotalChars,
      max_page_chars: options.maxPageChars,
      page_cards: pageCards.length,
    },
    headings: extractHeadings(pages),
    links: extractLinks(pages),
    page_cards: pageCards,
  };
  const markdown = renderMarkdown(lens);
  lens.compression.lens_chars = markdown.length;
  lens.compression.estimated_lens_tokens = estimateTokens(markdown.length);
  lens.compression.ratio =
    markdown.length && totalChars ? Number((totalChars / markdown.length).toFixed(2)) : null;
  return { lens, markdown };
}

function renderMarkdown(lens) {
  const lines = [
    "# OCR Lens",
    "",
    `Generated: ${lens.generated_at}`,
    `Source: ${lens.source.filename}`,
    `Status: ${lens.extraction.status}`,
    `Method: ${lens.extraction.method || "none"}`,
    `Pages: ${lens.extraction.pages_read}/${lens.extraction.page_count}`,
    `Text coverage: ${Math.round(lens.extraction.text_coverage * 100)}%`,
    `Estimated source tokens: ${lens.extraction.estimated_source_tokens}`,
    "",
    "## Warnings",
    "",
  ];

  if (lens.extraction.warnings.length) {
    for (const warning of lens.extraction.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push("- none");
  }

  lines.push("", "## Headings", "");
  if (lens.headings.length) {
    for (const heading of lens.headings.slice(0, 40)) lines.push(`- p.${heading.page}: ${heading.text}`);
  } else {
    lines.push("- none detected");
  }

  lines.push("", "## Links", "");
  if (lens.links.length) {
    for (const link of lens.links.slice(0, 30)) lines.push(`- p.${link.page}: ${link.url}`);
  } else {
    lines.push("- none detected");
  }

  lines.push("", "## Page Cards", "");
  for (const card of lens.page_cards) {
    lines.push(`### Page ${card.page} (${card.chars} chars, ${card.method || "unknown"})`, "");
    lines.push(card.snippet || "_No extractable text on this page._", "");
  }

  return `${lines.join("\n").trim()}\n`;
}

function writeOutputs(slug, lens, markdown) {
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${slug}.lens.json`);
  const markdownPath = path.join(outputDir, `${slug}.lens.md`);
  writeFileSync(jsonPath, `${JSON.stringify(lens, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, markdown, "utf8");
  writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(lens, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, "latest.md"), markdown, "utf8");
  return { jsonPath, markdownPath };
}

function pythonPath() {
  return process.env.THESEUS_PYTHON || process.env.PYTHON || bundledPython;
}

async function doctor() {
  const python = pythonPath();
  const result = await run(python, [
    "-c",
    "import importlib.util as u, json; mods=['pypdf','pdfplumber','PIL','pytesseract']; print(json.dumps({m: bool(u.find_spec(m)) for m in mods}))",
  ]);
  let modules = {};
  try {
    modules = JSON.parse(result.stdout);
  } catch {
    modules = {};
  }
  return {
    ok: result.ok,
    python,
    python_exists: existsSync(python),
    modules,
    stderr: result.stderr.trim(),
  };
}

async function lensFile(args) {
  if (!args.input) throw new Error("Usage: node tools/ocr_lens/ocr_lens.mjs <file.pdf> [--write]");
  const inputPath = path.resolve(args.input);
  if (!existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);
  const progress = createProgressReporter({ operation: "ocr-lens" });
  const stat = statSync(inputPath);
  const digest = sha256(inputPath);
  const ext = path.extname(inputPath).toLowerCase();
  progress.heartbeat("start", "building lightweight OCR lens", { file: path.basename(inputPath), size: stat.size });

  let extraction;
  if (ext === ".pdf") {
    progress.heartbeat("extract-pdf", "extracting embedded PDF text");
    const result = await run(pythonPath(), [extractorPath, inputPath, "--max-pages", String(args.maxPages)], {
      timeoutMs: 120_000,
    });
    try {
      extraction = JSON.parse(result.stdout);
    } catch {
      extraction = { ok: false, error: result.stderr || result.stdout || "PDF extractor returned invalid JSON", pages: [] };
    }
  } else if ([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"].includes(ext)) {
    extraction = {
      ok: false,
      method: null,
      page_count: 1,
      pages_read: 1,
      pages: [{ page: 1, method: null, chars: 0, text: "" }],
      attempts: [{ method: "image-ocr", ok: false, error: "No lightweight image OCR backend configured yet." }],
    };
  } else if ([".md", ".markdown", ".txt", ".json", ".jsonl", ".csv"].includes(ext)) {
    progress.heartbeat("extract-text", "building lens from text sidecar");
    extraction = extractTextFile(inputPath, args.maxPageChars);
  } else {
    throw new Error(`Unsupported input extension: ${ext}`);
  }

  const slug = slugFor(inputPath, digest);
  const { lens, markdown } = buildLens({ inputPath, digest, size: stat.size, extraction, options: args });
  let outputs = null;
  if (args.write) {
    outputs = writeOutputs(slug, lens, markdown);
    await writeTimelineEvent(
      {
        source: "ocr-lens",
        event: "ocr-lens-built",
        note: `${lens.extraction.status}: ${lens.source.filename}`,
        tags: ["ocr-lens", lens.extraction.status],
        artifacts: [path.relative(repoRoot, outputs.markdownPath), path.relative(repoRoot, outputs.jsonPath)],
        metrics: {
          pages: lens.extraction.page_count,
          total_chars: lens.extraction.total_chars,
          estimated_source_tokens: lens.extraction.estimated_source_tokens,
          estimated_lens_tokens: lens.compression.estimated_lens_tokens,
        },
      },
      { workspace: repoRoot },
    );
  }
  progress.done("lens ready", {
    status: lens.extraction.status,
    pages: lens.extraction.page_count,
    estimated_lens_tokens: lens.compression.estimated_lens_tokens,
  });
  return { lens, markdown, outputs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "doctor") {
    const payload = await doctor();
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = payload.ok ? 0 : 1;
    return;
  }

  const result = await lensFile(args);
  if (args.format === "json") console.log(JSON.stringify({ lens: result.lens, outputs: result.outputs }, null, 2));
  else console.log(result.markdown);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export { buildLens, renderMarkdown, slugFor, doctor, extractTextFile };
