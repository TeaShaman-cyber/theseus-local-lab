#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = {
    inputDir: join(process.cwd(), "outputs", "tool_policy"),
    outDir: join(process.cwd(), "outputs", "learning_loop"),
    days: 7,
    format: "markdown",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--input-dir") args.inputDir = argv[++i] || args.inputDir;
    else if (item === "--out-dir") args.outDir = argv[++i] || args.outDir;
    else if (item === "--days") args.days = Number(argv[++i] || args.days);
    else if (item === "--format") args.format = argv[++i] || args.format;
    else throw new Error(`Unknown option: ${item}`);
  }

  if (!Number.isFinite(args.days) || args.days < 1) throw new Error("--days must be a positive number");
  return args;
}

function cutoffForDays(days, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function topEntries(map, limit = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function extractEvent(raw, sourceFile) {
  const event = raw.result ? { type: "route-ranking", result: raw.result } : raw;
  const decision = event.decision;
  const ranking = event.result;
  return {
    sourceFile,
    ts: event.ts || raw.ts || null,
    action: event.action || null,
    decision: decision || null,
    ranking: ranking || null,
  };
}

async function readJsonlEvents(inputDir, days, now = new Date()) {
  let files = [];
  try {
    files = await readdir(inputDir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const cutoff = cutoffForDays(days, now);
  const events = [];
  for (const file of files.filter((name) => name.endsWith(".jsonl")).sort()) {
    const fullPath = join(inputDir, file);
    const text = await readFile(fullPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const event = extractEvent(parsed, file);
        const ts = event.ts ? new Date(event.ts) : null;
        if (ts && ts < cutoff) continue;
        events.push(event);
      } catch {
        events.push({ sourceFile: file, ts: null, parse_error: true, raw: line.slice(0, 120) });
      }
    }
  }
  return events;
}

function analyzeEvents(events) {
  const verdicts = new Map();
  const reasons = new Map();
  const reinforcement = new Map();
  const winners = new Map();
  const blockedRoutes = [];
  const proposals = [];
  let parseErrors = 0;

  for (const event of events) {
    if (event.parse_error) {
      parseErrors += 1;
      continue;
    }

    if (event.decision) {
      const verdict = event.decision.verdict || "unknown";
      const reason = event.decision.reason || "unknown";
      const kind =
        event.decision.reinforcement?.kind ||
        (verdict === "block" ? "friction" : verdict === "allow" ? "reward" : "neutral");
      increment(verdicts, verdict);
      increment(reasons, reason);
      increment(reinforcement, kind);
      if (verdict === "block") blockedRoutes.push({ reason, action: event.action });
    }

    if (event.ranking?.winner) {
      increment(winners, event.ranking.winner.command || event.ranking.winner.id || "unknown");
      const failedFit = event.ranking.ranked?.filter((route) => route.scores?.task_fit < 0) || [];
      for (const route of failedFit) increment(reasons, `bad-fit:${route.id || route.command || "route"}`);
    }
  }

  if ((reasons.get("raw-docker-shell") || 0) > 0) {
    proposals.push("Promote Docker MCP/VS Code task route before any raw Docker shell attempt.");
  }
  if ((reasons.get("raw-powershell-script") || 0) > 0) {
    proposals.push("Convert repeated PowerShell script routes into Node wrappers or VS Code tasks.");
  }
  if ((reasons.get("broad-git-stage") || 0) > 0) {
    proposals.push("Keep explicit-path staging as the default checkpoint route.");
  }
  if ((reasons.get("unclassified-shell") || 0) >= 2) {
    proposals.push("Review repeated unclassified shell commands and promote stable ones into wrappers/tasks.");
  }
  if ((reasons.get("bad-fit:all-skills") || 0) > 0 || (reasons.get("bad-fit:route-1") || 0) > 0) {
    proposals.push("Keep skill-router as the canonical path; do not load all project skills by default.");
  }
  if (proposals.length === 0) {
    proposals.push("No policy change proposed yet; collect more verified events before changing behavior.");
  }

  return {
    event_count: events.length,
    parse_errors: parseErrors,
    verdicts: Object.fromEntries(topEntries(verdicts, 20)),
    reasons: Object.fromEntries(topEntries(reasons, 20)),
    reinforcement: Object.fromEntries(topEntries(reinforcement, 20)),
    winners: Object.fromEntries(topEntries(winners, 10)),
    blocked_routes: blockedRoutes.slice(-10),
    proposals,
  };
}

function renderMarkdown(summary, { days }) {
  const lines = [
    `# Theseus Learning Loop ${dayStamp()}`,
    "",
    `Window: last ${days} day(s).`,
    "",
    "## Summary",
    "",
    `- Events: ${summary.event_count}`,
    `- Parse errors: ${summary.parse_errors}`,
    "",
    "## Verdicts",
    "",
  ];

  for (const [key, value] of Object.entries(summary.verdicts)) lines.push(`- ${key}: ${value}`);
  if (Object.keys(summary.verdicts).length === 0) lines.push("- none");

  lines.push("", "## Top Reasons", "");
  for (const [key, value] of Object.entries(summary.reasons)) lines.push(`- ${key}: ${value}`);
  if (Object.keys(summary.reasons).length === 0) lines.push("- none");

  lines.push("", "## Reinforcement", "");
  for (const [key, value] of Object.entries(summary.reinforcement)) lines.push(`- ${key}: ${value}`);
  if (Object.keys(summary.reinforcement).length === 0) lines.push("- none");

  lines.push("", "## Winning Routes", "");
  for (const [key, value] of Object.entries(summary.winners)) lines.push(`- ${key}: ${value}`);
  if (Object.keys(summary.winners).length === 0) lines.push("- none");

  lines.push("", "## Proposals", "");
  for (const proposal of summary.proposals) lines.push(`- ${proposal}`);

  lines.push(
    "",
    "## Guardrail",
    "",
    "Treat these proposals as review candidates. Do not turn route scores into final reward until a later task verifies the behavior.",
    "",
  );
  return lines.join("\n");
}

async function writeReport(summary, args) {
  await mkdir(args.outDir, { recursive: true });
  const reportPath = join(args.outDir, `${dayStamp()}-learning-loop.md`);
  await writeFile(reportPath, renderMarkdown(summary, args), "utf8");
  return reportPath;
}

export { analyzeEvents, readJsonlEvents, renderMarkdown };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const events = await readJsonlEvents(args.inputDir, args.days);
  const summary = analyzeEvents(events);
  const reportPath = await writeReport(summary, args);
  console.log(JSON.stringify({ reportPath, summary }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
