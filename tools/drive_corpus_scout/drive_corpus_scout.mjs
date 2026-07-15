#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { env, exit, stderr } from "node:process";
import { fileURLToPath } from "node:url";

import { createProgressReporter } from "../progress/progress.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "drive_corpus_scout");
const profilesPath = path.join(here, "profiles.json");
const defaultRoot = env.THESEUS_DRIVE_ROOT || "C:\\Users\\s.poklad\\Мой диск";
const reporter = createProgressReporter({ operation: "drive_corpus_scout" });

function parseArgs(argv) {
  const args = {
    root: defaultRoot,
    profile: "memory-research",
    query: "",
    top: 80,
    maxFiles: 20000,
    write: false,
    includeHidden: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--root") args.root = argv[++index] || args.root;
    else if (item === "--profile") args.profile = argv[++index] || args.profile;
    else if (item === "--query") args.query = argv[++index] || "";
    else if (item === "--top") args.top = clamp(argv[++index], 5, 500, args.top);
    else if (item === "--max-files") args.maxFiles = clamp(argv[++index], 100, 200000, args.maxFiles);
    else if (item === "--write") args.write = true;
    else if (item === "--include-hidden") args.includeHidden = true;
  }
  return args;
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function fail(message, details = {}) {
  stderr.write(`${JSON.stringify({ event: "drive_corpus_scout_error", status: "failed", message, ...details })}\n`);
  console.error(JSON.stringify({ status: "failed", message, ...details }, null, 2));
  exit(1);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}._-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function words(value) {
  return normalize(value)
    .split(/\s+/u)
    .filter((word) => word.length >= 2);
}

function fileId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

async function readProfiles() {
  const raw = await readFile(profilesPath, "utf8");
  return JSON.parse(raw);
}

function profileTerms(profile, query) {
  const terms = [];
  for (const value of profile.terms || []) terms.push(value);
  for (const value of profile.ru_terms || []) terms.push(value);
  for (const value of profile.en_terms || []) terms.push(value);
  if (query) terms.push(...query.split(/\s+/u).filter(Boolean));
  return [...new Set(terms.map(normalize).filter(Boolean))];
}

function shouldSkipDirectory(name, args) {
  if (args.includeHidden) return false;
  if (name.startsWith(".")) return true;
  return ["node_modules", ".git", "$RECYCLE.BIN", "System Volume Information"].includes(name);
}

async function scanDrive(root, args) {
  const queue = [path.resolve(root)];
  const files = [];
  let directories = 0;
  while (queue.length) {
    const dir = queue.shift();
    directories += 1;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name, args)) queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= args.maxFiles) return { files, directories, truncated: true };
      let info;
      try {
        info = await stat(fullPath);
      } catch {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      files.push({
        id: fileId(fullPath),
        path: fullPath,
        relative_path: path.relative(root, fullPath),
        name: entry.name,
        stem: path.basename(entry.name, ext),
        ext,
        size: info.size,
        modified_at: info.mtime.toISOString(),
      });
    }
    if (directories % 250 === 0) {
      reporter.heartbeat("scan", "scanning Drive metadata", { directories, files: files.length });
    }
  }
  return { files, directories, truncated: false };
}

async function enrichGdocPointer(file) {
  if (file.ext !== ".gdoc") return file;
  try {
    const raw = await readFile(file.path, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...file,
      gdoc: {
        url: parsed.url || "",
        doc_id: parsed.doc_id || parsed.resource_id || "",
      },
    };
  } catch {
    return file;
  }
}

function scoreFile(file, terms, profile) {
  const haystack = normalize(`${file.relative_path} ${file.name} ${file.stem} ${file.ext}`);
  const hayWords = new Set(words(haystack));
  const hits = [];
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    const direct = haystack.includes(term);
    const tokenHit = hayWords.has(term);
    if (!direct && !tokenHit) continue;
    hits.push(term);
    score += direct ? Math.max(3, Math.min(18, term.length / 2)) : 2;
  }
  const extBoost = profile.extensions?.includes(file.ext) ? 5 : 0;
  const recentDays = (Date.now() - Date.parse(file.modified_at)) / 86400000;
  const recencyBoost = Number.isFinite(recentDays) && recentDays < 45 ? 2 : 0;
  const gdocBoost = file.ext === ".gdoc" ? 1 : 0;
  return {
    ...file,
    score: Number((score + extBoost + recencyBoost + gdocBoost).toFixed(2)),
    hits: [...new Set(hits)].slice(0, 20),
  };
}

function summarizeExtensions(files) {
  const counts = new Map();
  for (const file of files) counts.set(file.ext || "(none)", (counts.get(file.ext || "(none)") || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 30)
    .map(([ext, count]) => ({ ext, count }));
}

function renderMarkdown(result) {
  const lines = [
    "# Drive Corpus Scout",
    "",
    `Generated: ${result.generated_at}`,
    `Root: ${result.root}`,
    `Profile: ${result.profile.id}`,
    `Description: ${result.profile.description}`,
    `Files scanned: ${result.scan.files}`,
    `Directories scanned: ${result.scan.directories}`,
    `Truncated: ${result.scan.truncated}`,
    "",
    "## Extension Summary",
    "",
    ...result.extension_summary.map((item) => `- ${item.ext}: ${item.count}`),
    "",
    "## Top Candidates",
    "",
  ];
  for (const [index, file] of result.candidates.entries()) {
    lines.push(`${index + 1}. ${file.name}`);
    lines.push(`   - score: ${file.score}; hits: ${file.hits.join(", ") || "none"}`);
    lines.push(`   - path: ${file.path}`);
    lines.push(`   - size: ${file.size}; modified: ${file.modified_at}`);
    if (file.gdoc?.url) lines.push(`   - gdoc: ${file.gdoc.url}`);
  }
  lines.push("");
  return `${lines.join("\n").trim()}\n`;
}

async function writeOutputs(result) {
  await mkdir(outputDir, { recursive: true });
  const safeProfile = result.profile.id.replace(/[^a-z0-9_-]+/gi, "-");
  const jsonPath = path.join(outputDir, `${safeProfile}.json`);
  const mdPath = path.join(outputDir, `${safeProfile}.md`);
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(result), "utf8");
  await writeFile(path.join(outputDir, "latest.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "latest.md"), renderMarkdown(result), "utf8");
  return { jsonPath, mdPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profiles = await readProfiles();
  const profile = profiles[args.profile];
  if (!profile) fail("Unknown profile", { profile: args.profile, available: Object.keys(profiles) });
  reporter.heartbeat("scan", "starting Drive metadata scan", { root: args.root, profile: args.profile });
  const scan = await scanDrive(args.root, args);
  const terms = profileTerms(profile, args.query);
  const enriched = await Promise.all(scan.files.map(enrichGdocPointer));
  const ranked = enriched
    .map((file) => scoreFile(file, terms, profile))
    .filter((file) => file.hits.length > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.modified_at) - Date.parse(a.modified_at))
    .slice(0, args.top);
  const result = {
    schema: "theseus.drive_corpus_scout.v1",
    generated_at: new Date().toISOString(),
    root: path.resolve(args.root),
    profile: { id: args.profile, ...profile },
    query: args.query,
    scan: {
      files: scan.files.length,
      directories: scan.directories,
      truncated: scan.truncated,
      max_files: args.maxFiles,
    },
    extension_summary: summarizeExtensions(scan.files),
    candidates: ranked,
  };
  const outputs = args.write ? await writeOutputs(result) : null;
  reporter.done("Drive corpus scout completed", {
    files: result.scan.files,
    candidates: ranked.length,
    output: outputs?.mdPath || null,
  });
  console.log(JSON.stringify({ status: "ok", files: result.scan.files, candidates: ranked.length, outputs, top: ranked.slice(0, 12) }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => fail(error.message || String(error)));
}

export { profileTerms, scoreFile };
