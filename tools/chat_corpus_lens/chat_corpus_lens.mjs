#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { env, exit, stderr } from "node:process";
import { fileURLToPath } from "node:url";

import { createProgressReporter } from "../progress/progress.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "chat_corpus_lens");
const graphifyOutputDir = path.join(repoRoot, "outputs", "graphify_harness");
const graphifyPilotRoot = env.GRAPHIFY_PILOT_ROOT || path.resolve(repoRoot, "..", "graphify-theseus-pilot");
const graphifyVenv = env.GRAPHIFY_VENV || path.join(repoRoot, "work", "graphify-pilot", "venv-codex");
const graphifyExe = path.join(
  graphifyVenv,
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "graphify.exe" : "graphify",
);
const reporter = createProgressReporter({ operation: "chat_corpus_lens" });

const defaultConcepts = [
  "DeepSeek",
  "MLA",
  "MoE",
  "GRPO",
  "Engram",
  "EvolveMem",
  "AutoMem",
  "MemPalace",
  "Graphify",
  "Falkor",
  "Codex",
  "harness",
  "observatory",
  "interoception",
  "IMF",
  "Wolfram",
  "A2A",
  "KV cache",
  "myelin",
  "mechanobiology",
  "solar",
  "SIF",
  "mycelium",
  "Страж",
  "Верфь",
  "Кузница",
];

function parseArgs(argv) {
  const args = {
    input: "",
    label: "strazh",
    query: "DeepSeek architecture memory harness Graphify",
    write: false,
    verbose: false,
    maxMessages: 120,
    maxQuoteChars: 520,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--input") args.input = argv[++i] || "";
    else if (item === "--label") args.label = argv[++i] || args.label;
    else if (item === "--query") args.query = argv[++i] || args.query;
    else if (item === "--write") args.write = true;
    else if (item === "--verbose") args.verbose = true;
    else if (item === "--max-messages") args.maxMessages = Number(argv[++i] || args.maxMessages);
    else if (item === "--max-quote-chars") args.maxQuoteChars = Number(argv[++i] || args.maxQuoteChars);
    else if (!item.startsWith("--") && !args.input) args.input = item;
  }
  if (!args.input) fail("Missing --input");
  args.maxMessages = clamp(args.maxMessages, 20, 500, 120);
  args.maxQuoteChars = clamp(args.maxQuoteChars, 160, 1400, 520);
  return args;
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function fail(message, details = {}) {
  stderr.write(`${JSON.stringify({ event: "chat_corpus_lens_error", status: "failed", message, ...details })}\n`);
  console.error(JSON.stringify({ status: "failed", message, ...details }, null, 2));
  exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || env,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: options.maxBuffer || 20 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || "",
  };
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
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function slug(value) {
  return String(value || "chat")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "chat";
}

function messageText(message) {
  const candidates = [
    message.content,
    message.text,
    message.message,
    message.markdown,
    message.rendered_content,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  if (Array.isArray(message.contents)) {
    return message.contents.map((item) => (typeof item === "string" ? item : item?.text || item?.content || "")).join("\n");
  }
  return "";
}

function extractMessages(parsed) {
  const rawMessages = parsed.chat_messages || parsed.messages || parsed.data?.messages || [];
  return rawMessages
    .map((message, index) => ({
      index: index + 1,
      id: message.message_id || message.id || index + 1,
      parent_id: message.parent_id || null,
      role: String(message.role || message.author?.role || "unknown").toLowerCase(),
      model: message.model || message.model_name || "",
      text: cleanText(messageText(message)),
      accumulated_token_usage: message.accumulated_token_usage ?? null,
      inserted_at: message.inserted_at || message.created_at || null,
      updated_at: message.updated_at || null,
    }))
    .filter((message) => message.text);
}

function extractUrls(text, limit = 120) {
  const urls = [];
  const seen = new Set();
  for (const match of text.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
    const url = match[0].replace(/[.,;:"')\]]+$/g, "");
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

function countConcepts(messages, concepts) {
  const counts = new Map(concepts.map((concept) => [concept, { concept, count: 0, roles: new Map(), messages: [] }]));
  for (const message of messages) {
    const text = message.text.toLowerCase();
    for (const concept of concepts) {
      const needle = concept.toLowerCase();
      const matches = text.split(needle).length - 1;
      if (!matches) continue;
      const record = counts.get(concept);
      record.count += matches;
      record.roles.set(message.role, (record.roles.get(message.role) || 0) + matches);
      if (record.messages.length < 8) record.messages.push(message.index);
    }
  }
  return [...counts.values()]
    .filter((record) => record.count > 0)
    .sort((a, b) => b.count - a.count || a.concept.localeCompare(b.concept))
    .map((record) => ({
      concept: record.concept,
      count: record.count,
      roles: Object.fromEntries(record.roles.entries()),
      sample_messages: record.messages,
    }));
}

function scoreMessage(message, conceptCounts, query) {
  const lower = message.text.toLowerCase();
  const queryTerms = cleanText(query).toLowerCase().split(/\s+/).filter((term) => term.length > 3);
  const queryScore = queryTerms.reduce((sum, term) => sum + (lower.includes(term) ? 5 : 0), 0);
  const conceptScore = conceptCounts.reduce((sum, item) => sum + (lower.includes(item.concept.toLowerCase()) ? Math.min(8, item.count) : 0), 0);
  const urlScore = /https?:\/\//.test(message.text) ? 4 : 0;
  const roleScore = message.role.includes("assistant") ? 2 : 1;
  return queryScore + conceptScore + urlScore + roleScore;
}

function compactQuote(text, maxChars) {
  const clean = cleanText(text);
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const boundary = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
  return `${slice.slice(0, boundary > maxChars * 0.55 ? boundary : maxChars).trim()} [...]`;
}

function buildLens({ inputPath, parsed, messages, options, digest, size }) {
  const allText = messages.map((message) => message.text).join("\n\n");
  const concepts = countConcepts(messages, defaultConcepts);
  const topMessages = messages
    .map((message) => ({ ...message, score: scoreMessage(message, concepts, options.query) }))
    .filter((message) => message.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, options.maxMessages);
  const urls = extractUrls(allText);
  const roleCounts = {};
  for (const message of messages) roleCounts[message.role] = (roleCounts[message.role] || 0) + 1;
  const sourceChars = allText.length;
  const messageChars = topMessages.reduce((sum, message) => sum + Math.min(message.text.length, options.maxQuoteChars), 0);
  const lens = {
    schema: "theseus.chat_corpus_lens.v1",
    generated_at: new Date().toISOString(),
    query: options.query,
    source: {
      path: inputPath,
      filename: path.basename(inputPath),
      size,
      sha256: digest,
      chat_title: parsed.chat_session?.title || parsed.title || "",
    },
    extraction: {
      messages: messages.length,
      selected_messages: topMessages.length,
      role_counts: roleCounts,
      urls: urls.length,
      concepts: concepts.length,
      total_chars: sourceChars,
      estimated_source_tokens: estimateTokens(sourceChars),
      status: messages.length ? "lens_ready" : "no_messages",
    },
    concepts,
    urls: urls.slice(0, 40),
    selected_messages: topMessages.map((message) => ({
      index: message.index,
      id: message.id,
      role: message.role,
      score: message.score,
      token_usage: message.accumulated_token_usage,
      quote: compactQuote(message.text, options.maxQuoteChars),
    })),
  };
  const markdown = renderMarkdown(lens);
  lens.compression = {
    selected_message_chars: messageChars,
    lens_chars: markdown.length,
    estimated_lens_tokens: estimateTokens(markdown.length),
    source_to_lens_ratio: markdown.length ? Number((sourceChars / markdown.length).toFixed(2)) : null,
  };
  return { lens, markdown };
}

function renderMarkdown(lens) {
  const lines = [
    "# Chat Corpus Lens",
    "",
    `Generated: ${lens.generated_at}`,
    `Source: ${lens.source.filename}`,
    `Title: ${lens.source.chat_title || "unknown"}`,
    `Status: ${lens.extraction.status}`,
    `Query: ${lens.query}`,
    `Messages: ${lens.extraction.messages}`,
    `Selected messages: ${lens.extraction.selected_messages}`,
    `Estimated source tokens: ${lens.extraction.estimated_source_tokens}`,
    "",
    "## Top Concepts",
    "",
  ];
  for (const item of lens.concepts.slice(0, 20)) {
    lines.push(`- ${item.concept}: ${item.count} (${Object.entries(item.roles).map(([role, count]) => `${role}:${count}`).join(", ")})`);
  }
  lines.push("", "## Sources / Links", "");
  for (const url of lens.urls.slice(0, 25)) lines.push(`- ${url}`);
  lines.push("", "## Selected Messages", "");
  for (const message of lens.selected_messages.slice(0, 30)) {
    lines.push(`### #${message.index} ${message.role} score=${message.score}`, "");
    lines.push(message.quote, "");
  }
  return `${lines.join("\n").trim()}\n`;
}

function graphIdentifier(value) {
  return slug(value).replace(/-/g, "_") || "concept";
}

function buildGraphCorpus(lens, label) {
  const privateRoot = path.join(graphifyPilotRoot, "chat-corpus", slug(label));
  const corpusDir = path.join(privateRoot, "corpus");
  const outRoot = path.join(privateRoot, "out");
  rmSync(corpusDir, { recursive: true, force: true });
  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(corpusDir, { recursive: true });

  const conceptNames = lens.concepts.slice(0, 30).map((item) => item.concept);
  const lines = [
    "// Generated concept graph corpus for Graphify code-only extraction.",
    "// Contains no full raw transcript; only concept labels and selected relationships.",
    "",
    "export const chatCorpus = {",
    `  title: ${JSON.stringify(lens.source.chat_title || label)},`,
    `  messages: ${lens.extraction.messages},`,
    `  selectedMessages: ${lens.extraction.selected_messages},`,
    "};",
    "",
  ];
  for (const concept of conceptNames) {
    lines.push(`export function concept_${graphIdentifier(concept)}() { return ${JSON.stringify(concept)}; }`);
  }
  lines.push("", "export function theseus_strazh_theme_map() {");
  for (const concept of conceptNames.slice(0, 18)) {
    lines.push(`  concept_${graphIdentifier(concept)}();`);
  }
  lines.push("}", "");
  for (const message of lens.selected_messages.slice(0, 24)) {
    const messageConcepts = conceptNames.filter((concept) => message.quote.toLowerCase().includes(concept.toLowerCase())).slice(0, 8);
    lines.push(`export function message_${message.index}_${message.role.replace(/[^a-z0-9]+/gi, "_")}() {`);
    for (const concept of messageConcepts) lines.push(`  concept_${graphIdentifier(concept)}();`);
    lines.push("}", "");
  }

  const corpusPath = path.join(corpusDir, "strazh_concepts.js");
  writeFileSync(corpusPath, `${lines.join("\n")}\n`, "utf8");
  return { privateRoot, corpusDir, outRoot, corpusPath, graphPath: path.join(outRoot, "graphify-out", "graph.json") };
}

function runGraphify(lens, label) {
  if (!existsSync(graphifyExe)) {
    return { ok: false, error: `Graphify executable missing: ${graphifyExe}` };
  }
  const graph = buildGraphCorpus(lens, label);
  reporter.heartbeat("graphify-extract", "building Graphify concept graph", { corpus: graph.corpusDir });
  const extract = run(graphifyExe, ["extract", graph.corpusDir, "--code-only", "--out", graph.outRoot, "--no-cluster"]);
  if (!extract.ok) return { ok: false, graph, extract };
  const graphJson = JSON.parse(readFileSync(graph.graphPath, "utf8"));
  const stats = {
    nodes: Array.isArray(graphJson.nodes) ? graphJson.nodes.length : 0,
    edges: Array.isArray(graphJson.edges) ? graphJson.edges.length : 0,
  };
  const query = run(graphifyExe, [
    "query",
    "what connects DeepSeek memory harness Graphify",
    "--graph",
    graph.graphPath,
    "--budget",
    "1200",
  ]);
  return { ok: true, graph, extract, stats, query };
}

function writeOutputs(label, lens, markdown, graphify) {
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(graphifyOutputDir, { recursive: true });
  const safeLabel = slug(label);
  const jsonPath = path.join(outputDir, `${safeLabel}.lens.json`);
  const mdPath = path.join(outputDir, `${safeLabel}.lens.md`);
  const reportPath = path.join(outputDir, `${safeLabel}.report.md`);
  writeFileSync(jsonPath, `${JSON.stringify(lens, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, markdown, "utf8");
  writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(lens, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, "latest.md"), markdown, "utf8");

  const report = [
    "# Chat Corpus Lens Trial",
    "",
    `Generated: ${lens.generated_at}`,
    `Label: ${label}`,
    "",
    "## Compression",
    "",
    `- Raw estimated tokens: ${lens.extraction.estimated_source_tokens}`,
    `- Lens estimated tokens: ${lens.compression.estimated_lens_tokens}`,
    `- Source to lens ratio: ${lens.compression.source_to_lens_ratio}`,
    `- Messages: ${lens.extraction.messages}`,
    `- Selected messages: ${lens.extraction.selected_messages}`,
    "",
    "## Graphify Concept Graph",
    "",
    graphify?.ok
      ? `- Status: ok\n- Nodes: ${graphify.stats.nodes}\n- Edges: ${graphify.stats.edges}\n- Graph: ${graphify.graph.graphPath}`
      : `- Status: failed\n- Error: ${graphify?.error || graphify?.extract?.stderr || "unknown"}`,
    "",
    "## Graphify Query",
    "",
    "```text",
    graphify?.query?.stdout?.trim() || graphify?.query?.stderr?.trim() || "not available",
    "```",
    "",
    "## Top Concepts",
    "",
    ...lens.concepts.slice(0, 16).map((item) => `- ${item.concept}: ${item.count}`),
    "",
  ].join("\n");
  writeFileSync(reportPath, report, "utf8");
  return { jsonPath, mdPath, reportPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  if (!existsSync(inputPath)) fail("Input file not found", { input: inputPath });
  const stat = statSync(inputPath);
  const digest = sha256(inputPath);
  reporter.heartbeat("read", "reading chat export", { file: path.basename(inputPath), size: stat.size });
  const parsed = JSON.parse(readFileSync(inputPath, "utf8"));
  const messages = extractMessages(parsed);
  const { lens, markdown } = buildLens({ inputPath, parsed, messages, options: args, digest, size: stat.size });
  reporter.heartbeat("lens", "chat lens built", {
    messages: lens.extraction.messages,
    estimated_lens_tokens: lens.compression.estimated_lens_tokens,
    ratio: lens.compression.source_to_lens_ratio,
  });
  const graphify = runGraphify(lens, args.label);
  const outputs = args.write ? writeOutputs(args.label, lens, markdown, graphify) : null;
  reporter.done("chat corpus lens completed", {
    status: lens.extraction.status,
    graphify: graphify?.ok ? "ok" : "failed",
    outputs: outputs?.reportPath || null,
  });
  const summary = {
    status: "ok",
    source: lens.source.filename,
    title: lens.source.chat_title,
    messages: lens.extraction.messages,
    selected_messages: lens.extraction.selected_messages,
    estimated_source_tokens: lens.extraction.estimated_source_tokens,
    estimated_lens_tokens: lens.compression.estimated_lens_tokens,
    source_to_lens_ratio: lens.compression.source_to_lens_ratio,
    graphify: {
      ok: graphify?.ok || false,
      stats: graphify?.stats || null,
      graph_path: graphify?.graph?.graphPath || null,
      error: graphify?.error || graphify?.extract?.stderr || "",
    },
    outputs,
  };
  console.log(JSON.stringify(args.verbose ? { ...summary, lens, graphify } : summary, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

export { buildLens, countConcepts, extractMessages };
