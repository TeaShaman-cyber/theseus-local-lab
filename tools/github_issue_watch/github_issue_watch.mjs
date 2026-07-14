#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, exit } from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const DEFAULT_REPO = "openai/codex";
const DEFAULT_LIMIT = 40;
const KEYWORDS = [
  ["sandbox", /\b(sandbox|permission|approval|acl|security|policy)\b/i],
  ["windows", /\b(windows|powershell|pwsh|cmd|store|desktop)\b/i],
  ["wsl", /\bwsl\b|ubuntu|linux/i],
  ["docker", /\b(docker|container|compose)\b/i],
  ["git", /\b(git|github|ssh|credential|auth)\b/i],
  ["memory", /\b(memory|context|compact|conversation|history)\b/i],
  ["mcp", /\b(mcp|connector|tool|server)\b/i],
  ["crash", /\b(crash|hang|freeze|stuck|error|exception|fail|deadlock)\b/i],
  ["network", /\b(proxy|vpn|network|rate-limit|rate-limits|timeout|connection|connectivity|websocket)\b/i],
  ["ui", /\b(ui|ux|interface|render|screen|window|renderer)\b/i],
];

const HIGH_SIGNAL_LABELS = /\b(sandbox|mcp|rate-limits|connectivity|session|performance|browser|app-server|tool-calls|auth|config)\b/i;

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    limit: DEFAULT_LIMIT,
    sinceHours: 72,
    format: "markdown",
    write: false,
    outputDir: path.join(repoRoot, "outputs", "github_issue_watch"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--repo") args.repo = argv[++i] || args.repo;
    else if (item === "--limit") args.limit = Number(argv[++i] || args.limit);
    else if (item === "--since-hours") args.sinceHours = Number(argv[++i] || args.sinceHours);
    else if (item === "--output-dir") args.outputDir = path.resolve(argv[++i] || args.outputDir);
    else if (item === "--write") args.write = true;
    else if (item === "--json") args.format = "json";
    else if (item === "--markdown") args.format = "markdown";
  }

  args.limit = Math.max(1, Math.min(100, Number.isFinite(args.limit) ? args.limit : DEFAULT_LIMIT));
  args.sinceHours = Math.max(1, Number.isFinite(args.sinceHours) ? args.sinceHours : 72);
  return args;
}

function repoSlug(repo) {
  return repo.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}

function truncate(text, length = 180) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized;
  return `${normalized.slice(0, length - 1).trim()}...`;
}

function issueSignalText(issue) {
  return `${issue.title || ""}\n${(issue.labels || []).map((label) => label.name).join(" ")}`;
}

function tagsFor(issue) {
  const text = issueSignalText(issue);
  return KEYWORDS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

function hoursBetween(a, b) {
  return Math.max(0, (a.getTime() - b.getTime()) / 3_600_000);
}

function classifyIssue(issue, now, sinceHours) {
  const createdAt = new Date(issue.created_at);
  const updatedAt = new Date(issue.updated_at);
  const labels = (issue.labels || []).map((label) => label.name);
  const tags = tagsFor(issue);
  const isNew = hoursBetween(now, createdAt) <= sinceHours;
  const recentlyUpdated = hoursBetween(now, updatedAt) <= sinceHours;
  const isHighSignal =
    tags.some((tag) => ["sandbox", "wsl", "docker", "memory", "mcp", "crash", "network"].includes(tag)) ||
    Number(issue.comments || 0) >= 5 ||
    labels.some((label) => HIGH_SIGNAL_LABELS.test(label));

  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    comments: issue.comments || 0,
    labels,
    tags,
    is_new: isNew,
    recently_updated: recentlyUpdated,
    high_signal: isHighSignal,
    excerpt: truncate(issue.body || ""),
  };
}

async function fetchIssues({ repo, limit }) {
  const url = new URL(`https://api.github.com/repos/${repo}/issues`);
  url.searchParams.set("state", "open");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", String(limit));

  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "theseus-local-lab-github-issue-watch",
    "x-github-api-version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const response = await fetch(url, { headers });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${truncate(body, 300)}`);
  }
  const parsed = JSON.parse(body);
  return parsed.filter((item) => !item.pull_request);
}

function summarize(issues, args) {
  const now = new Date();
  const classified = issues.map((issue) => classifyIssue(issue, now, args.sinceHours));
  const tagCounts = new Map();
  for (const issue of classified) {
    for (const tag of issue.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  return {
    generated_at: now.toISOString(),
    repo: args.repo,
    source_url: `https://github.com/${args.repo}/issues`,
    window_hours: args.sinceHours,
    fetched_open_issues: classified.length,
    new_count: classified.filter((issue) => issue.is_new).length,
    updated_count: classified.filter((issue) => issue.recently_updated).length,
    high_signal_count: classified.filter((issue) => issue.high_signal).length,
    tags,
    issues: classified,
  };
}

function renderMarkdown(summary) {
  const highSignal = summary.issues.filter((issue) => issue.high_signal).slice(0, 12);
  const recent = summary.issues.filter((issue) => issue.is_new || issue.recently_updated).slice(0, 12);
  const lines = [
    "# OpenAI Codex GitHub Issues Field Report",
    "",
    `Generated: ${summary.generated_at}`,
    `Source: ${summary.source_url}`,
    `Window: last ${summary.window_hours}h`,
    "",
    `Open fetched: ${summary.fetched_open_issues}`,
    `New in window: ${summary.new_count}`,
    `Updated in window: ${summary.updated_count}`,
    `High-signal for Theseus: ${summary.high_signal_count}`,
    "",
    "## Tag Pressure",
    "",
  ];

  if (summary.tags.length === 0) lines.push("- none");
  for (const item of summary.tags.slice(0, 10)) lines.push(`- ${item.tag}: ${item.count}`);

  lines.push("", "## High-Signal Issues", "");
  if (highSignal.length === 0) lines.push("- none");
  for (const issue of highSignal) {
    lines.push(
      `- #${issue.number} ${issue.title} (${issue.tags.join(", ") || "untagged"}, comments: ${issue.comments})`,
      `  ${issue.url}`,
    );
  }

  lines.push("", "## Fresh / Updated", "");
  if (recent.length === 0) lines.push("- none");
  for (const issue of recent) {
    const flags = [issue.is_new ? "new" : null, issue.recently_updated ? "updated" : null].filter(Boolean).join(", ");
    lines.push(`- #${issue.number} ${issue.title} (${flags || "seen"})`, `  ${issue.url}`);
  }

  lines.push("");
  return lines.join("\n");
}

async function writeOutputs(summary, markdown, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const slug = repoSlug(summary.repo);
  const jsonPath = path.join(outputDir, `${slug}.json`);
  const mdPath = path.join(outputDir, `${slug}.md`);
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(mdPath, markdown, "utf8");
  return { jsonPath, mdPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issues = await fetchIssues(args);
  const summary = summarize(issues, args);
  const markdown = renderMarkdown(summary);
  if (args.write) await writeOutputs(summary, markdown, args.outputDir);
  if (args.format === "json") console.log(JSON.stringify(summary, null, 2));
  else console.log(markdown);
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
