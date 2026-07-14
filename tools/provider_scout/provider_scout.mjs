#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { env, exit } from "node:process";
import { createProgressReporter } from "../progress/progress.mjs";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const defaultOutputDir = path.join(repoRoot, "outputs", "provider_scout");
const codexHome = env.CODEX_HOME || path.join(os.homedir(), ".codex");

const signatures = [
  {
    id: "model-capacity",
    category: "provider-capacity",
    severity: "WARN",
    patterns: [/Selected model is at capacity/i, /model at capacity/i, /try a different model/i],
    next_step: "Preserve task intent, retry later or switch model deliberately; do not blame local code.",
  },
  {
    id: "rate-limit",
    category: "provider-rate-limit",
    severity: "WARN",
    patterns: [/rate[- ]?limit/i, /429\b/i, /UsageLimitExceeded/i, /quota/i],
    next_step: "Record model, mode, and reset window; avoid immediate retry loops.",
  },
  {
    id: "provider-timeout",
    category: "provider-network",
    severity: "WARN",
    patterns: [/SSE.*zero events/i, /handshake operation timed out/i, /timed out/i, /ECONNRESET/i],
    next_step: "Compare provider status, local proxy route, and repeatability before changing project code.",
  },
  {
    id: "provider-auth",
    category: "provider-auth",
    severity: "FAIL",
    patterns: [/401\b|403\b|unauthorized|forbidden|invalid api key|authentication/i],
    next_step: "Check keychain/provider auth without printing secrets.",
  },
];

const githubQueries = [
  '"Selected model is at capacity" repo:openai/codex',
  '"Retry automatically when the selected model is at capacity" repo:openai/codex',
  '"capacity errors should preserve intent" repo:openai/codex',
  '"Retry transient capacity errors" repo:openai/codex',
];

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    loop: false,
    intervalSeconds: 900,
    outputDir: defaultOutputDir,
    sinceHours: 72,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--write") args.write = true;
    else if (item === "--json") args.json = true;
    else if (item === "--loop") args.loop = true;
    else if (item === "--interval-seconds") args.intervalSeconds = Number(argv[++i] || args.intervalSeconds);
    else if (item === "--output-dir") args.outputDir = path.resolve(argv[++i] || args.outputDir);
    else if (item === "--since-hours") args.sinceHours = Number(argv[++i] || args.sinceHours);
  }
  args.intervalSeconds = Math.max(60, Number.isFinite(args.intervalSeconds) ? args.intervalSeconds : 900);
  args.sinceHours = Math.max(1, Number.isFinite(args.sinceHours) ? args.sinceHours : 72);
  return args;
}

function truncate(value, length = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= length ? text : `${text.slice(0, length - 1).trim()}...`;
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "theseus-provider-scout" },
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: truncate(text) };
    }
    return { ok: response.ok, status: response.status, body: parsed };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function githubSearch(query) {
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "10");
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "theseus-provider-scout",
    "x-github-api-version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    const parsed = JSON.parse(text);
    if (!response.ok) return { ok: false, query, status: response.status, error: truncate(text) };
    return {
      ok: true,
      query,
      total_count: parsed.total_count || 0,
      items: (parsed.items || []).slice(0, 8).map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state,
        updated_at: item.updated_at,
      })),
    };
  } catch (error) {
    return { ok: false, query, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function listRecentSessionFiles(root, sinceHours) {
  const sessionsDir = path.join(root, "sessions");
  if (!existsSync(sessionsDir)) return [];
  const cutoff = Date.now() - sinceHours * 3_600_000;
  const files = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".jsonl")) continue;
      const info = await stat(full);
      if (info.mtime.getTime() >= cutoff) files.push({ path: full, mtime: info.mtime, size: info.size });
    }
  }

  await walk(sessionsDir);
  return files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()).slice(0, 24);
}

function classifyText(text, source) {
  const matches = [];
  for (const signature of signatures) {
    const count = signature.patterns.reduce((total, pattern) => {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      return total + [...text.matchAll(new RegExp(pattern.source, flags))].length;
    }, 0);
    if (count > 0) {
      matches.push({
        id: signature.id,
        category: signature.category,
        severity: signature.severity,
        source,
        count,
        next_step: signature.next_step,
      });
    }
  }
  return matches;
}

async function scanLocalSessions({ sinceHours }) {
  const files = await listRecentSessionFiles(codexHome, sinceHours);
  const matches = [];
  for (const file of files) {
    const text = await readFile(file.path, "utf8");
    const sample = text
      .slice(Math.max(0, text.length - 1_200_000))
      .split(/\r?\n/)
      .filter((line) => {
        const lower = line.toLowerCase();
        if (lower.includes("github.com/openai/codex/issues/")) return false;
        if (lower.includes("provider_scout")) return false;
        if (lower.includes("gh search issues")) return false;
        if (lower.includes("gh issue list")) return false;
        if (lower.includes("provider-scout")) return false;
        return (
          lower.includes("function_call_output") ||
          lower.includes("error") ||
          lower.includes("failed") ||
          lower.includes("usage") ||
          lower.includes("capacity") ||
          lower.includes("timeout") ||
          lower.includes("401") ||
          lower.includes("403") ||
          lower.includes("429")
        );
      })
      .join("\n");
    matches.push(
      ...classifyText(sample, {
        file: path.relative(codexHome, file.path).replaceAll("\\", "/"),
        modified_at: file.mtime.toISOString(),
      }),
    );
  }
  return { scanned_files: files.length, matches };
}

async function collectStatus() {
  const summary = await fetchJson("https://status.openai.com/api/v2/summary.json");
  if (!summary.ok) return { ok: false, error: summary.error || `HTTP ${summary.status}` };
  const body = summary.body;
  const incidents = (body.incidents || []).filter((incident) => incident.status !== "resolved");
  const scheduled = (body.scheduled_maintenances || []).filter((item) => !["completed", "resolved"].includes(item.status));
  return {
    ok: true,
    page: body.page?.url || "https://status.openai.com/",
    indicator: body.status?.indicator || "unknown",
    description: body.status?.description || "unknown",
    active_incidents: incidents.map((incident) => ({
      name: incident.name,
      status: incident.status,
      impact: incident.impact,
      updated_at: incident.updated_at,
      url: incident.shortlink,
    })),
    scheduled_maintenances: scheduled.map((item) => ({
      name: item.name,
      status: item.status,
      impact: item.impact,
      updated_at: item.updated_at,
      url: item.shortlink,
    })),
  };
}

function summarize(report) {
  const localCount = report.local.matches.reduce((total, item) => total + item.count, 0);
  const githubTotal = report.github.searches.reduce((total, item) => total + (item.total_count || 0), 0);
  const statusWarn = !report.openai_status.ok || report.openai_status.indicator !== "none";
  const localWarn = localCount > 0;
  const githubWarn = githubTotal > 0;
  return {
    status: statusWarn || localWarn ? "WARN" : "OK",
    local_match_count: localCount,
    github_capacity_issue_count: githubTotal,
    openai_status_indicator: report.openai_status.indicator || "unknown",
    notes: [
      statusWarn ? "OpenAI status page is not fully green or was unreachable." : "OpenAI status page is green/reachable.",
      localWarn ? "Local Codex session logs contain provider-failure signatures." : "No provider-failure signatures found in recent local Codex sessions.",
      githubWarn ? "Open GitHub issues mention matching capacity/provider failure symptoms." : "No matching GitHub capacity issues found.",
    ],
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Provider Scout",
    "",
    `Generated: ${report.generated_at}`,
    `Overall: ${report.summary.status}`,
    "",
    "## Summary",
    "",
    `- OpenAI status: ${report.summary.openai_status_indicator}`,
    `- Local provider-failure matches: ${report.summary.local_match_count}`,
    `- GitHub capacity issue matches: ${report.summary.github_capacity_issue_count}`,
    "",
    "## Notes",
    "",
    ...report.summary.notes.map((note) => `- ${note}`),
    "",
    "## Local Signals",
    "",
  ];

  if (!report.local.matches.length) lines.push("- none");
  for (const match of report.local.matches) {
    lines.push(`- ${match.id}: ${match.count} (${match.category}) in ${match.source.file}`);
  }

  lines.push("", "## GitHub Signals", "");
  for (const search of report.github.searches) {
    lines.push(`- ${search.query}: ${search.ok ? search.total_count : `error ${search.error || search.status}`}`);
    for (const item of search.items || []) lines.push(`  - #${item.number} ${item.title} ${item.url}`);
  }

  lines.push("", "## OpenAI Status", "");
  if (!report.openai_status.ok) lines.push(`- unavailable: ${report.openai_status.error}`);
  else {
    lines.push(`- ${report.openai_status.description}`);
    if (!report.openai_status.active_incidents.length) lines.push("- active incidents: none");
    for (const incident of report.openai_status.active_incidents) {
      lines.push(`- incident: ${incident.name} (${incident.impact}, ${incident.status}) ${incident.url || ""}`.trim());
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function writeOutputs(report, markdown, outputDir) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "provider-scout.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "provider-scout.md"), markdown, "utf8");
}

async function collect(args) {
  const progress = createProgressReporter({ operation: "provider-scout" });
  progress.heartbeat("openai-status", "Checking OpenAI public status");
  const openaiStatus = await collectStatus();
  progress.heartbeat("local-sessions", "Scanning recent local Codex session logs");
  const local = await scanLocalSessions(args);
  progress.heartbeat("github-search", "Searching public Codex provider-failure issues");
  const searches = await Promise.all(githubQueries.map(githubSearch));
  const report = {
    generated_at: new Date().toISOString(),
    codex_home: codexHome,
    openai_status: openaiStatus,
    local,
    github: { repo: "openai/codex", searches },
  };
  report.summary = summarize(report);
  return report;
}

async function collectOnce(args) {
  const report = await collect(args);
  const markdown = renderMarkdown(report);
  if (args.write) {
    await writeOutputs(report, markdown, args.outputDir);
    await writeTimelineEvent(
      {
        source: "provider-scout",
        event: "provider-health-scan",
        note: `${report.summary.status}: ${report.summary.local_match_count} local provider matches, ${report.summary.github_capacity_issue_count} GitHub issue matches`,
        tags: ["provider-scout", report.summary.status.toLowerCase()],
        artifacts: [
          path.relative(repoRoot, path.join(args.outputDir, "provider-scout.json")),
          path.relative(repoRoot, path.join(args.outputDir, "provider-scout.md")),
        ],
        metrics: {
          local_match_count: report.summary.local_match_count,
          github_capacity_issue_count: report.summary.github_capacity_issue_count,
        },
      },
      { workspace: repoRoot },
    );
  }
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(markdown);
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.loop) {
    await collectOnce(args);
    return;
  }
  while (true) {
    await collectOnce({ ...args, write: true, json: false });
    await new Promise((resolve) => setTimeout(resolve, args.intervalSeconds * 1000));
  }
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
