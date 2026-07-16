#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "recurrence_audit");

function readText(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  if (!existsSync(absolute)) return null;
  return readFileSync(absolute, "utf8");
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { parse_error: error.message };
  }
}

function readJsonl(relativePath) {
  const text = readText(relativePath);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { parse_error: error.message, line: line.slice(0, 160) };
      }
    });
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function todayFile(dir) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `outputs/${dir}/${stamp}.jsonl`;
}

function maxSeverity(items) {
  if (items.some((item) => item.status === "FAIL")) return "FAIL";
  if (items.some((item) => item.status === "WARN")) return "WARN";
  return "OK";
}

function statusFromCount(count, warnAt = 1, failAt = Infinity) {
  if (count >= failAt) return "FAIL";
  if (count >= warnAt) return "WARN";
  return "OK";
}

function summarizeHookConfig() {
  const projectHooks = readJson(".codex/hooks.json");
  const projectConfig = readText(".codex/config.toml") || "";
  const globalHooksPath = "C:/Users/s.poklad/.codex/hooks.json";
  let globalHooks = null;
  if (existsSync(globalHooksPath)) {
    try {
      globalHooks = JSON.parse(readFileSync(globalHooksPath, "utf8"));
    } catch (error) {
      globalHooks = { parse_error: error.message };
    }
  }

  const projectEvents = projectHooks?.hooks ? Object.keys(projectHooks.hooks) : [];
  const globalEvents = globalHooks?.hooks ? Object.keys(globalHooks.hooks) : [];
  const duplicatedEvents = projectEvents.filter((event) => globalEvents.includes(event));
  const configHasCodexRuntime = /sandbox_mode|approval_policy|\[hooks\]|PreCompact|PostCompact|UserPromptSubmit|Stop/.test(projectConfig);
  const parseErrors = [projectHooks, globalHooks].filter((item) => item?.parse_error).length;
  const duplicatePostCompact = (projectEvents.filter((event) => event === "PostCompact").length > 1) || (globalEvents.filter((event) => event === "PostCompact").length > 1);

  const problems = [];
  if (parseErrors) problems.push(`${parseErrors} hook JSON parse error(s)`);
  if (duplicatedEvents.length) problems.push(`global/project duplicate events: ${duplicatedEvents.join(", ")}`);
  if (configHasCodexRuntime) problems.push("project .codex/config.toml still contains runtime/hook-adjacent settings");
  if (duplicatePostCompact) problems.push("duplicate PostCompact key detected");

  return {
    id: "hook-config",
    title: "Codex hook/config sources",
    status: problems.length ? "WARN" : "OK",
    evidence: problems.length ? problems : ["single readable project hook source"],
    recommendation: problems.length
      ? "Keep one canonical hook representation; move stale runtime settings out of project config or mark them as fallback."
      : "No hook-source recurrence visible.",
    data: { project_events: projectEvents, global_events: globalEvents, duplicated_events: duplicatedEvents },
  };
}

function summarizeContextPressure() {
  const files = [todayFile("context_pressure"), "outputs/context_pressure/2026-07-15.jsonl"];
  const events = files.flatMap((file) => readJsonl(file).map((event) => ({ ...event, _file: file })));
  const warnings = events.filter((event) => /WARN|FAIL/i.test(event.status || event.recommendation || ""));
  const latest = readJson("outputs/context_pressure/latest.json");
  const latestStatus = latest?.status || "unknown";
  const status = latestStatus === "FAIL"
    ? "FAIL"
    : latestStatus === "WARN" || warnings.length
      ? "WARN"
      : "OK";
  return {
    id: "context-pressure",
    title: "Context pressure and compact warnings",
    status,
    evidence: [
      `${warnings.length} WARN/FAIL context-pressure event(s) across recent logs`,
      latest ? `latest status=${latestStatus} usage=${latest.signals?.usage?.used_percent ?? latest.usage_percent ?? latest.usage_ratio ?? "n/a"} recommendation=${latest.recommendation || "n/a"}` : "latest context-pressure cache missing",
    ],
    recommendation: warnings.length
      ? "Keep compact checkpoint monitor visible; add a dashboard alert when state packet age crosses threshold."
      : "No context-pressure recurrence in recent logs.",
    data: {
      recent_status_counts: countBy(events, (event) => event.status || "unknown"),
      latest,
    },
  };
}

function summarizeTaskGraph() {
  const graph = readJson("outputs/task_graph/latest.json") || readJson("outputs/task_graph/graph.json");
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const tasks = nodes.filter((node) => node.type === "task" || node.id?.startsWith?.("task-"));
  const markerEdges = Array.isArray(graph?.edges) ? graph.edges.filter((edge) => edge.type === "has-marker") : [];
  const markerCounts = countBy(markerEdges, (edge) => String(edge.target || "unknown").replace(/^marker:/, ""));

  const warnCount = Object.entries(markerCounts)
    .filter(([key]) => /raw-docker-2375|legacy-monolith-path|powershell-route/i.test(key))
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    id: "task-portability",
    title: "VS Code task portability markers",
    status: statusFromCount(warnCount, 1, 30),
    evidence: [
      `${tasks.length || "unknown"} task node(s) in cached graph`,
      `${warnCount} high-friction marker edge(s): raw Docker 2375, legacy monolith path, or PowerShell route`,
    ],
    recommendation: warnCount
      ? "Continue task cleanup by replacing repeated PowerShell/raw-2375 routes with Node/WSL wrappers and marked fallback tasks."
      : "No high-friction task markers visible in cached graph.",
    data: { marker_counts: markerCounts },
  };
}

function summarizeProgressAudit() {
  const audit = readJson("outputs/progress_audit/progress-audit.json");
  const warningCount = audit?.warning_count ?? 0;
  return {
    id: "progress-visibility",
    title: "Long-operation progress visibility",
    status: statusFromCount(warningCount, 1, 20),
    evidence: audit
      ? [`${warningCount} progress warning(s)`, `${audit.items?.length || 0} long-operation candidate(s)`]
      : ["progress audit cache missing"],
    recommendation: warningCount
      ? "Patch highest-frequency long operations with JSONL progress to stderr before more large migrations."
      : "Progress instrumentation looks adequate in the cached audit.",
    data: {
      top_warnings: (audit?.items || []).filter((item) => item.status === "warning").slice(0, 8),
    },
  };
}

function summarizeGitAndScratch() {
  const status = runGit(["status", "--porcelain=v1"]);
  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  const outputChanges = lines.filter((line) => / outputs[\\/]/.test(line) || /^(\?\?| M|M ) outputs[\\/]/.test(line));
  const tmpFiles = lines.filter((line) => /outputs[\\/]tmp|tmp[\\/]/.test(line));
  return {
    id: "git-scratch",
    title: "Dirty generated outputs and scratch files",
    status: status.ok && (outputChanges.length || tmpFiles.length) ? "WARN" : status.ok ? "OK" : "FAIL",
    evidence: status.ok
      ? [`${lines.length} worktree change(s)`, `${outputChanges.length} generated output change(s)`, `${tmpFiles.length} scratch/tmp change(s)`]
      : [`git status failed: ${(status.stderr || status.stdout).slice(0, 200)}`],
    recommendation: outputChanges.length || tmpFiles.length
      ? "Before large work, classify generated output changes as migrate/keep/drop so checkpoints stay readable."
      : "No dirty generated-output recurrence visible.",
    data: { changes: lines.slice(0, 40) },
  };
}

function summarizeMemoryReflex() {
  const reflex = readJson("outputs/memory_reflex/latest.json");
  const recall = readJson("outputs/memory_reflex/latest_recall.json");
  const hookEvents = readJsonl(todayFile("memory_hook"));
  const hookCounts = countBy(hookEvents, (event) => event.kind || event.event || event.type || "unknown");
  const ok = reflex && !reflex.parse_error;
  const status = !ok ? "WARN" : reflex.status === "FAIL" ? "FAIL" : reflex.status === "WARN" ? "WARN" : "OK";
  return {
    id: "memory-reflex",
    title: "Memory reflex observability",
    status,
    evidence: [
      ok ? `latest reflex status=${reflex.status || reflex.ok || "recorded"}` : "latest memory reflex cache missing or unreadable",
      recall ? "latest recall artifact present" : "latest recall artifact missing",
      `${hookEvents.length} memory hook event(s) today`,
    ],
    recommendation: ok
      ? "Keep memory reflex as a startup/checkpoint guard, not a manual reminder."
      : "Repair memory reflex cache before relying on compaction safety.",
    data: { hook_counts: hookCounts },
  };
}

function summarizeHarnessErrors() {
  const candidates = ["outputs/harness_errors/2026-07-14-harness-errors.json", "outputs/harness_errors/2026-07-13-harness-errors.json"]
    .map(readJson)
    .filter(Boolean);
  const items = candidates.flatMap((file) => file.items || file.errors || file.findings || []);
  const classCounts = countBy(items, (item) => item.class || item.failure_class || item.id || item.title || "unknown");
  return {
    id: "harness-errors",
    title: "Known harness failure classes",
    status: items.length ? "WARN" : "OK",
    evidence: items.length ? [`${items.length} known harness finding(s) in cached reports`] : ["no cached harness findings"],
    recommendation: items.length
      ? "Prefer classifying new failures against this list before blaming model behavior."
      : "No harness error cache available.",
    data: { class_counts: classCounts },
  };
}

function buildReport() {
  const items = [
    summarizeHookConfig(),
    summarizeContextPressure(),
    summarizeTaskGraph(),
    summarizeProgressAudit(),
    summarizeGitAndScratch(),
    summarizeMemoryReflex(),
    summarizeHarnessErrors(),
  ];
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    status: maxSeverity(items),
    items,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Recurrence Audit",
    "",
    `Generated: ${report.generated_at}`,
    `Overall: ${report.status}`,
    "",
    "This audit looks for small recurring friction patterns before large technical-debt work.",
    "",
    "| Status | Pattern | Evidence | Next move |",
    "|---|---|---|---|",
  ];
  for (const item of report.items) {
    lines.push(`| ${item.status} | ${item.title} | ${item.evidence.join("<br>")} | ${item.recommendation} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- A warning is not blame. It is a candidate for a cheap guardrail, wrapper, dashboard row, or explicit fallback label.");
  lines.push("- Route scores and warning counts are not learning by themselves; changes still need causal repair and verification.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const report = buildReport();
  if (args.has("--write")) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(path.join(outputDir, "latest.md"), renderMarkdown(report));
  }
  if (args.has("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Recurrence audit: ${report.status}; ${report.items.filter((item) => item.status !== "OK").length} active pattern(s).`);
  for (const item of report.items.filter((item) => item.status !== "OK")) {
    console.log(`- ${item.status} ${item.title}: ${item.evidence[0]}`);
  }
}

main();
