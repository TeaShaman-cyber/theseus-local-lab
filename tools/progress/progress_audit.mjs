#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const defaultOutputDir = path.join(repoRoot, "outputs", "progress_audit");

const skipDirs = new Set([".git", "node_modules", "work", "outputs", ".vs"]);
const scanRoots = ["tools", "scripts"];

const riskPatterns = [
  { id: "network-download", regex: /\b(fetch|https\.get|get)\s*\(|urllib\.request|Invoke-WebRequest|curl|wget/i },
  { id: "archive-work", regex: /\b(tar\.exe|tarfile|make_archive|extract|archive|\.zip|\.tar\.gz)\b/i },
  { id: "docker-image-work", regex: /docker\s+(image\s+)?(save|load|pull|build)|docker\s+compose.*\b(build|pull|up)\b/i },
  { id: "ssh-transfer", regex: /\b(scp|rsync|sftp)\b/i },
  { id: "backup-or-mirror", regex: /\b(backup|mirror|copy2|shutil\.copy|sqlite.*backup)\b/i },
  { id: "explicit-wait", regex: /\b(setTimeout|sleep|timeoutMs|while\s+True|while\s*\()/i },
];

const progressPatterns = [
  /tools[\\/]progress[\\/]progress\.mjs/i,
  /createProgressReporter|createByteProgress/i,
  /progress|heartbeat/i,
  /stderr|console\.error|process\.stderr|flush=True/i,
];

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    write: argv.includes("--write"),
    outputDir: valueAfter(argv, "--output-dir") || defaultOutputDir,
  };
}

function valueAfter(argv, key) {
  const index = argv.indexOf(key);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

async function listFiles(root) {
  const absolute = path.join(repoRoot, root);
  if (!existsSync(absolute)) return [];
  const found = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) await walk(path.join(dir, entry.name));
        continue;
      }
      if (/\.(mjs|js|py|json)$/i.test(entry.name)) found.push(path.join(dir, entry.name));
    }
  }

  await walk(absolute);
  return found;
}

function relativePath(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function classify(file, text) {
  const risks = riskPatterns.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.id);
  if (risks.length === 0) return null;
  const hasProgress = progressPatterns.some((pattern) => pattern.test(text));
  return {
    file: relativePath(file),
    risks,
    status: hasProgress ? "ok" : "warning",
    recommendation: hasProgress
      ? "Progress or heartbeat signal found."
      : "Add machine-readable progress or heartbeat events to stderr before using this for long work.",
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Progress Audit",
    "",
    `Generated: ${report.generated_at}`,
    `Scanned files: ${report.scanned_files}`,
    `Warnings: ${report.warning_count}`,
    "",
    "| Status | File | Risks | Recommendation |",
    "|---|---|---|---|",
  ];
  for (const item of report.items) {
    lines.push(`| ${item.status} | ${item.file} | ${item.risks.join(", ")} | ${item.recommendation} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = (await Promise.all(scanRoots.map(listFiles))).flat();
  const items = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const item = classify(file, text);
    if (item) items.push(item);
  }

  items.sort((a, b) => a.status.localeCompare(b.status) || a.file.localeCompare(b.file));
  const report = {
    ok: true,
    generated_at: new Date().toISOString(),
    scanned_files: files.length,
    warning_count: items.filter((item) => item.status === "warning").length,
    items,
  };

  if (args.write) {
    await mkdir(args.outputDir, { recursive: true });
    await writeFile(path.join(args.outputDir, "progress-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.join(args.outputDir, "progress-audit.md"), renderMarkdown(report));
  }

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Progress audit: ${report.warning_count} warning(s), ${report.items.length} long-operation candidate(s).`);
    if (args.write) console.log(`Report: ${path.join(args.outputDir, "progress-audit.md")}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
