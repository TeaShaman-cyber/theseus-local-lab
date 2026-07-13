#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SCAN_DIRS = ["outputs", "TASKS.md"];

const SIGNATURES = [
  {
    id: "harness-history-replay",
    title: "Responses item history/replay mismatch",
    category: "codex-harness",
    patterns: [/web_search_call[\s\S]{0,180}required ['"]reasoning['"] item/i, /required ['"]reasoning['"] item[\s\S]{0,180}web_search_call/i],
    explanation:
      "A structured Responses item was replayed or validated without its paired reasoning item. Treat as harness/history hydration, not model memory.",
    next_step: "Capture exact task/UI action and avoid replaying partial response-item histories.",
  },
  {
    id: "windows-sandbox-socket",
    title: "Windows socket denied",
    category: "windows-network",
    patterns: [/WinError 10013/i, /access a socket.*forbidden by its access permissions/i, /сокету методом, запрещенным правами доступа/i],
    explanation:
      "Windows, sandbox, firewall, proxy, or account permissions denied socket access.",
    next_step: "Route network probes through the configured proxy/context and record which user/sandbox ran the check.",
  },
  {
    id: "proxy-network-timeout",
    title: "TLS handshake timeout",
    category: "network-proxy",
    patterns: [/_ssl\.c:\d+:\s*The handshake operation timed out/i, /handshake operation timed out/i],
    explanation:
      "TLS negotiation timed out, usually network/proxy/routing instability rather than a Codex logic error.",
    next_step: "Compare direct, system proxy, and v2rayN-routed checks before changing application code.",
  },
  {
    id: "ephemeral-local-file",
    title: "Ephemeral local file missing",
    category: "local-file-lifecycle",
    patterns: [/Codex could not read the local image/i, /No such file or directory \(os error 2\)/i, /codex-clipboard-[\w-]+\.(png|jpg|jpeg)/i],
    explanation:
      "A temp UI file disappeared before Codex could read it.",
    next_step: "Move important screenshots/files into the project or Downloads before relying on them.",
  },
];

function parseArgs(argv) {
  const args = {
    scan: [...DEFAULT_SCAN_DIRS],
    outDir: join(process.cwd(), "outputs", "harness_errors"),
    limitBytes: 1_000_000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--scan") args.scan = (argv[++i] || "").split(",").map((part) => part.trim()).filter(Boolean);
    else if (item === "--out-dir") args.outDir = argv[++i] || args.outDir;
    else if (item === "--limit-bytes") args.limitBytes = Number(argv[++i] || args.limitBytes);
    else throw new Error(`Unknown option: ${item}`);
  }
  return args;
}

async function collectFiles(root, entries) {
  const files = [];
  async function visit(path) {
    let info;
    try {
      info = await stat(path);
    } catch {
      return;
    }
    if (info.isDirectory()) {
      for (const child of await readdir(path)) await visit(join(path, child));
      return;
    }
    if (!/\.(md|txt|json|jsonl|log)$/i.test(path)) return;
    files.push(path);
  }
  for (const entry of entries) await visit(join(root, entry));
  return files.sort();
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function excerptAround(text, index, size = 180) {
  const start = Math.max(0, index - size);
  const end = Math.min(text.length, index + size);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function classifyText(text, source) {
  const matches = [];
  for (const signature of SIGNATURES) {
    for (const pattern of signature.patterns) {
      const match = pattern.exec(text);
      if (!match) continue;
      matches.push({
        id: signature.id,
        title: signature.title,
        category: signature.category,
        source,
        line: lineNumberFor(text, match.index),
        excerpt: excerptAround(text, match.index),
        explanation: signature.explanation,
        next_step: signature.next_step,
      });
      break;
    }
  }
  return matches;
}

function summarize(matches) {
  const byId = new Map();
  const byCategory = new Map();
  for (const match of matches) {
    byId.set(match.id, (byId.get(match.id) || 0) + 1);
    byCategory.set(match.category, (byCategory.get(match.category) || 0) + 1);
  }
  return {
    match_count: matches.length,
    by_id: Object.fromEntries([...byId.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    by_category: Object.fromEntries([...byCategory.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    matches,
  };
}

function renderMarkdown(summary) {
  const lines = ["# Harness Error Report", "", `Matches: ${summary.match_count}`, "", "## By Signature", ""];
  for (const [id, count] of Object.entries(summary.by_id)) lines.push(`- ${id}: ${count}`);
  if (!Object.keys(summary.by_id).length) lines.push("- none");
  lines.push("", "## By Category", "");
  for (const [category, count] of Object.entries(summary.by_category)) lines.push(`- ${category}: ${count}`);
  if (!Object.keys(summary.by_category).length) lines.push("- none");
  lines.push("", "## Matches", "");
  for (const match of summary.matches) {
    lines.push(`### ${match.id}`);
    lines.push("");
    lines.push(`- Source: ${match.source}:${match.line}`);
    lines.push(`- Category: ${match.category}`);
    lines.push(`- Meaning: ${match.explanation}`);
    lines.push(`- Next step: ${match.next_step}`);
    lines.push(`- Excerpt: ${match.excerpt}`);
    lines.push("");
  }
  if (!summary.matches.length) lines.push("No known harness error signatures found.", "");
  return lines.join("\n");
}

async function scanHarnessErrors({ root = process.cwd(), scan = DEFAULT_SCAN_DIRS, outDir, limitBytes = 1_000_000 } = {}) {
  const files = await collectFiles(root, scan);
  const matches = [];
  for (const file of files) {
    const info = await stat(file);
    if (info.size > limitBytes) continue;
    const text = await readFile(file, "utf8");
    matches.push(...classifyText(text, relative(root, file)));
  }
  const summary = summarize(matches);
  await mkdir(outDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const jsonPath = join(outDir, `${day}-harness-errors.json`);
  const markdownPath = join(outDir, `${day}-harness-errors.md`);
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(summary), "utf8");
  return { jsonPath, markdownPath, summary };
}

export { SIGNATURES, classifyText, summarize, renderMarkdown, scanHarnessErrors };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await scanHarnessErrors({ ...args, root: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
