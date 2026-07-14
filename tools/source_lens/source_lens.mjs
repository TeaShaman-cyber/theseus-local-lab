#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProgressReporter } from "../progress/progress.mjs";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "source_lens");
const memoryInboxDir = path.join(repoRoot, "outputs", "memory_inbox");

function parseArgs(argv) {
  const args = {
    input: "",
    query: "",
    write: false,
    memoryDraft: false,
    format: "markdown",
    maxItems: 30,
    maxTextChars: 9000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--input") args.input = argv[++i] || "";
    else if (item === "--query") args.query = argv[++i] || "";
    else if (item === "--write") args.write = true;
    else if (item === "--memory-draft") args.memoryDraft = true;
    else if (item === "--json") args.format = "json";
    else if (item === "--markdown") args.format = "markdown";
    else if (item === "--max-items") args.maxItems = clamp(argv[++i], 1, 200, 30);
    else if (item === "--max-text-chars") args.maxTextChars = clamp(argv[++i], 1000, 60000, 9000);
    else if (!item.startsWith("--") && !args.input) args.input = item;
  }
  return args;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function slugFor(filePath, digest) {
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const safe = base.replace(/[^a-z0-9а-яё_-]+/giu, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "source";
  return `${safe}-${digest.slice(0, 10)}`;
}

function normalizeUrl(url) {
  return String(url || "").trim().replace(/[.,;:"')\]]+$/g, "");
}

function sourceType(url) {
  const value = String(url || "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("arxiv.org") || value.includes("doi.org") || value.includes("biorxiv.org") || value.includes("nature.com") || value.includes("sciencedirect.com")) return "paper";
  if (value.includes("github.com")) return "github";
  if (value.includes("learn.microsoft.com") || value.includes("learn.chatgpt.com") || value.includes("docs.") || value.includes("/docs/")) return "docs";
  if (value.includes("reddit.com") || value.includes("news.ycombinator.com")) return "community";
  return "web";
}

function scoreSource(item, query = "") {
  const haystack = `${item.title || ""} ${item.snippet || ""} ${item.url || ""}`.toLowerCase();
  const terms = cleanText(query).toLowerCase().split(/\s+/).filter((term) => term.length > 3);
  const termScore = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 2 : 0), 0);
  const typeScore = { paper: 8, docs: 7, github: 6, web: 4, community: 3, unknown: 1 }[item.source_type] || 1;
  const titleScore = item.title ? 2 : 0;
  const snippetScore = item.snippet && item.snippet.length > 80 ? 2 : 0;
  return typeScore + titleScore + snippetScore + termScore;
}

function compactSnippet(value, maxChars = 420) {
  const text = cleanText(value);
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const boundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
  return `${slice.slice(0, boundary > maxChars * 0.55 ? boundary : maxChars).trim()} [...]`;
}

function extractClaims(text, limit = 20) {
  const claims = [];
  const sentences = cleanText(text).split(/(?<=[.!?])\s+|\n+/u);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 60 || trimmed.length > 320) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^see\s+https?:\/\//i.test(trimmed)) continue;
    if (/\b(should|must|shows?|suggests?|reports?|confirmed|failed|error|warning|hypothesis|correlation|model|token|limit|usage|docker|codex)\b/i.test(trimmed)
      || /должн|показыва|гипотез|корреляц|модель|токен|лимит|ошибк|сбой|кодекс|докер/i.test(trimmed)) {
      claims.push(trimmed);
    }
    if (claims.length >= limit) break;
  }
  return claims;
}

function extractHeadings(text, limit = 40) {
  const headings = [];
  for (const line of cleanText(text).split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length < 4 || trimmed.length > 160) continue;
    if (/^(#{1,6}\s|[0-9]+(\.[0-9]+)*\s+|[A-ZА-ЯЁ][^.!?]{4,100}$)/u.test(trimmed)) {
      headings.push(trimmed);
      if (headings.length >= limit) break;
    }
  }
  return headings;
}

function extractLinksFromText(text, limit = 100) {
  const links = [];
  const seen = new Set();
  for (const match of cleanText(text).matchAll(/https?:\/\/[^\s)>\]]+/g)) {
    const url = normalizeUrl(match[0]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push(url);
    if (links.length >= limit) break;
  }
  return links;
}

function flattenJson(value, pathName = "$", out = []) {
  if (out.length > 10000) return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenJson(item, `${pathName}[${index}]`, out));
  } else if (value && typeof value === "object") {
    out.push({ path: pathName, value });
    for (const [key, child] of Object.entries(value)) flattenJson(child, `${pathName}.${key}`, out);
  }
  return out;
}

function pickField(object, names) {
  for (const name of names) {
    if (typeof object[name] === "string" && object[name].trim()) return object[name].trim();
  }
  return "";
}

function jsonObjectToSource(object, index) {
  const url = normalizeUrl(pickField(object, ["url", "link", "href", "source_url", "html_url", "web_url"]));
  const title = pickField(object, ["title", "name", "label", "heading", "subject"]);
  const snippet = pickField(object, ["snippet", "summary", "description", "body", "text", "content", "excerpt"]);
  const date = pickField(object, ["date", "published", "published_at", "updated_at", "created_at"]);
  if (!url && !title && !snippet) return null;
  return {
    id: `s${index}`,
    title: title || url || `source ${index}`,
    url,
    date,
    snippet: compactSnippet(snippet || title || url),
    source_type: sourceType(url),
    origin: "json-object",
  };
}

function parseJsonSources(raw) {
  const values = [];
  try {
    values.push(JSON.parse(raw));
  } catch {
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        values.push(JSON.parse(line));
      } catch {
        // Keep parsing best-effort JSONL.
      }
    }
  }
  const sources = [];
  const seen = new Set();
  for (const value of values) {
    for (const entry of flattenJson(value)) {
      const source = jsonObjectToSource(entry.value, sources.length + 1);
      if (!source) continue;
      const key = source.url || `${source.title}:${source.snippet}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(source);
    }
  }
  return sources;
}

function parseTextSources(raw) {
  const text = cleanText(raw);
  const headings = extractHeadings(text);
  const links = extractLinksFromText(text);
  const claims = extractClaims(text, 40);
  const sources = links.map((url, index) => ({
    id: `s${index + 1}`,
    title: url,
    url,
    date: "",
    snippet: "",
    source_type: sourceType(url),
    origin: "text-link",
  }));
  return { text, headings, links, claims, sources };
}

function buildSourceLens({ inputPath, raw, digest, size, options }) {
  const ext = path.extname(inputPath).toLowerCase();
  const textParts = parseTextSources(raw);
  const jsonSources = [".json", ".jsonl"].includes(ext) ? parseJsonSources(raw) : [];
  const sources = (jsonSources.length ? jsonSources : textParts.sources)
    .map((source) => ({ ...source, score: scoreSource(source, options.query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.maxItems);
  const claims = jsonSources.length
    ? extractClaims(jsonSources.map((source) => `${source.title}. ${source.snippet}`).join("\n"), 40)
    : textParts.claims;
  const route = sources.slice(0, 12).map((source, index) => ({
    rank: index + 1,
    id: source.id,
    action: source.source_type === "community" ? "read-if-needed" : "read-next",
    reason: `${source.source_type}; score ${source.score}`,
    url: source.url,
    title: source.title,
  }));

  const sourceChars = raw.length;
  const lens = {
    schema: "theseus.source_lens.v1",
    generated_at: new Date().toISOString(),
    query: options.query || "",
    source: {
      path: inputPath,
      filename: path.basename(inputPath),
      size,
      sha256: digest,
      extension: ext,
    },
    extraction: {
      format: [".json", ".jsonl"].includes(ext) ? "json" : "text",
      total_chars: sourceChars,
      estimated_source_tokens: estimateTokens(sourceChars),
      source_count: sources.length,
      claim_count: claims.length,
      heading_count: textParts.headings.length,
      link_count: textParts.links.length,
      status: sources.length || claims.length || textParts.headings.length ? "lens_ready" : "thin_signal",
      warnings: sources.length ? [] : ["No structured sources detected; use as a text summary lens only."],
    },
    headings: textParts.headings.slice(0, 40),
    claims: claims.slice(0, 24),
    sources,
    route,
  };
  const markdown = renderMarkdown(lens);
  lens.compression = {
    lens_chars: markdown.length,
    estimated_lens_tokens: estimateTokens(markdown.length),
    ratio: markdown.length && sourceChars ? Number((sourceChars / markdown.length).toFixed(2)) : null,
  };
  return { lens, markdown };
}

function renderMarkdown(lens) {
  const lines = [
    "# Source Lens",
    "",
    `Generated: ${lens.generated_at}`,
    `Source: ${lens.source.filename}`,
    `Status: ${lens.extraction.status}`,
    `Query: ${lens.query || "none"}`,
    `Sources: ${lens.extraction.source_count}`,
    `Claims: ${lens.extraction.claim_count}`,
    `Estimated source tokens: ${lens.extraction.estimated_source_tokens}`,
    "",
    "## Reading Route",
    "",
  ];

  if (lens.route.length) {
    for (const item of lens.route) {
      lines.push(`${item.rank}. ${item.title}`);
      lines.push(`   - ${item.reason}`);
      if (item.url) lines.push(`   - ${item.url}`);
    }
  } else {
    lines.push("- no ranked route");
  }

  lines.push("", "## Claims", "");
  if (lens.claims.length) {
    for (const claim of lens.claims.slice(0, 24)) lines.push(`- ${claim}`);
  } else {
    lines.push("- none detected");
  }

  lines.push("", "## Headings", "");
  if (lens.headings.length) {
    for (const heading of lens.headings.slice(0, 40)) lines.push(`- ${heading}`);
  } else {
    lines.push("- none detected");
  }

  lines.push("", "## Sources", "");
  for (const source of lens.sources) {
    lines.push(`### ${source.id}: ${source.title}`);
    lines.push(`- type: ${source.source_type}`);
    lines.push(`- score: ${source.score}`);
    if (source.date) lines.push(`- date: ${source.date}`);
    if (source.url) lines.push(`- url: ${source.url}`);
    if (source.snippet) lines.push(`- snippet: ${source.snippet}`);
    lines.push("");
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

function buildMemoryDraft(lens, outputs = {}) {
  const routeLines = lens.route
    .slice(0, 6)
    .map((item) => `${item.rank}. ${item.title}${item.url ? ` (${item.url})` : ""}`)
    .join("\n");
  const claimLines = lens.claims.slice(0, 8).map((claim) => `- ${claim}`).join("\n");
  const content = [
    `Source lens for ${lens.source.filename}.`,
    lens.query ? `Query: ${lens.query}.` : "",
    `Status: ${lens.extraction.status}; sources: ${lens.extraction.source_count}; claims: ${lens.extraction.claim_count}.`,
    routeLines ? `Reading route:\n${routeLines}` : "",
    claimLines ? `Claims:\n${claimLines}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 1200);

  return {
    content,
    tags: ["theseus-local-lab", "source-lens", lens.extraction.status, lens.source.extension.replace(/^\./, "") || "source"],
    importance: lens.extraction.source_count > 0 ? 0.78 : 0.62,
    type: "Context",
    metadata: {
      schema: lens.schema,
      source_file: lens.source.filename,
      source_sha256: lens.source.sha256,
      source_path: lens.source.path,
      query: lens.query,
      source_count: lens.extraction.source_count,
      claim_count: lens.extraction.claim_count,
      markdown_path: outputs.markdownPath || "",
      json_path: outputs.jsonPath || "",
    },
  };
}

function writeMemoryDraft(slug, lens, outputs) {
  mkdirSync(memoryInboxDir, { recursive: true });
  const draft = buildMemoryDraft(lens, outputs);
  const draftPath = path.join(memoryInboxDir, `${slug}.source-lens.memory.json`);
  writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return { draftPath, draft };
}

async function lensFile(args) {
  if (!args.input) throw new Error("Usage: node tools/source_lens/source_lens.mjs <file.json|file.md> [--write]");
  const inputPath = path.resolve(args.input);
  if (!existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);
  const progress = createProgressReporter({ operation: "source-lens" });
  const stat = statSync(inputPath);
  const digest = sha256(inputPath);
  const ext = path.extname(inputPath).toLowerCase();
  progress.heartbeat("start", "building source lens", { file: path.basename(inputPath), size: stat.size });
  const rawFull = readFileSync(inputPath, "utf8");
  const raw = [".json", ".jsonl"].includes(ext) ? rawFull : rawFull.slice(0, args.maxTextChars);
  const { lens, markdown } = buildSourceLens({ inputPath, raw, digest, size: stat.size, options: args });
  let outputs = null;
  let memoryDraft = null;
  if (args.write) {
    const slug = slugFor(inputPath, digest);
    outputs = writeOutputs(slug, lens, markdown);
    if (args.memoryDraft) memoryDraft = writeMemoryDraft(slug, lens, outputs);
    await writeTimelineEvent(
      {
        source: "source-lens",
        event: "source-lens-built",
        note: `${lens.extraction.status}: ${lens.source.filename}`,
        tags: ["source-lens", lens.extraction.status],
        artifacts: [
          path.relative(repoRoot, outputs.markdownPath),
          path.relative(repoRoot, outputs.jsonPath),
          memoryDraft?.draftPath ? path.relative(repoRoot, memoryDraft.draftPath) : "",
        ].filter(Boolean),
        metrics: {
          sources: lens.extraction.source_count,
          claims: lens.extraction.claim_count,
          estimated_source_tokens: lens.extraction.estimated_source_tokens,
          estimated_lens_tokens: lens.compression.estimated_lens_tokens,
        },
      },
      { workspace: repoRoot },
    );
  }
  progress.done("lens ready", {
    status: lens.extraction.status,
    sources: lens.extraction.source_count,
    estimated_lens_tokens: lens.compression.estimated_lens_tokens,
  });
  return { lens, markdown, outputs, memoryDraft };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await lensFile(args);
  if (args.format === "json") {
    console.log(JSON.stringify({ lens: result.lens, outputs: result.outputs, memoryDraft: result.memoryDraft }, null, 2));
  }
  else console.log(result.markdown);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export { buildMemoryDraft, buildSourceLens, parseJsonSources, parseTextSources, scoreSource, renderMarkdown };
