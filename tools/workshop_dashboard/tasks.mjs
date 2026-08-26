#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const GROUPS = [
  ["git", "Git & safety", /git|commit|staged|secret scan/i],
  ["memory", "Memory", /memory|automem|mempalace|compact|state packet/i],
  ["docker", "Docker & services", /docker|dashboard|graph viewer|log lattice|backup runner|keychain|secrets|tcp/i],
  ["graph", "Graph lens", /graphify|graph lens|repo graph|structural repo/i],
  ["observability", "Observability", /timeline|journal|harness|learning loop|workshop|observatory|status|system watch|sysinternals|scout/i],
  ["advisors", "Advisors", /advisor|bothub|codewhale|council/i],
  ["vm", "VM & SSH", /vm|ssh|ubuntu|image transfer/i],
  ["research", "Research & data", /research|stra?zh|index|inventory|lint|github issue|field report/i],
];

const CAPABILITIES = [
  ["git", "Git", /git|commit|staged|secret scan|push/i],
  ["memory", "Memory", /memory|automem|mempalace|compact|state packet/i],
  ["docker", "Docker", /docker|compose|container|image|tcp|graph viewer/i],
  ["secrets", "Secrets", /secret|keychain|infisical|providers env/i],
  ["backup", "Backup", /backup|mirror|archive/i],
  ["graph", "Graph lens", /graphify|graph lens|repo graph|structural repo/i],
  ["observability", "Observability", /status|health|timeline|journal|log lattice|dashboard|harness|learning loop|system watch|sysinternals|scout/i],
  ["advisor", "Advisors", /advisor|bothub|council|codewhale/i],
  ["vm", "VM/SSH", /vm|ssh|ubuntu|image transfer/i],
  ["research", "Research", /research|stra?zh|index|inventory|observatory|github issue|field report/i],
  ["lint", "Lint/check", /lint|check|scan|verify|smoke/i],
];

const PREFLIGHT_BUNDLES = [
  {
    id: "docker-preflight",
    label: "Docker preflight",
    description: "Check container visibility, active Docker route, and service health before Docker actions.",
    capabilities: ["docker", "observability", "lint"],
  },
  {
    id: "memory-preflight",
    label: "Memory preflight",
    description: "Check AutoMem, MemPalace, graph viewer, and compact-state routes before memory-sensitive work.",
    capabilities: ["memory", "docker", "observability"],
  },
  {
    id: "secrets-preflight",
    label: "Secrets preflight",
    description: "Check Infisical/keychain and provider smoke routes before advisor or model-provider work.",
    capabilities: ["secrets", "advisor", "lint"],
  },
  {
    id: "backup-preflight",
    label: "Backup preflight",
    description: "Check backup runner, local archive, cloud mirror, and manifest verification before risky changes.",
    capabilities: ["backup", "docker", "observability", "lint"],
  },
  {
    id: "vm-preflight",
    label: "VM/SSH preflight",
    description: "Check SSH health, VM inventory, and image-transfer manifest before VM operations.",
    capabilities: ["vm", "docker", "lint", "observability"],
  },
  {
    id: "git-preflight",
    label: "Git preflight",
    description: "Check status, staged secret scan, and checkpoint route before publishing work.",
    capabilities: ["git", "lint", "observability"],
  },
];

const PORTABILITY_MARKERS = [
  {
    id: "raw-docker-2375",
    label: "Raw Docker 2375",
    severity: "WARN",
    pattern: /127\.0\.0\.1:2375|DOCKER_HOST/i,
    detail: "Windows-local Docker bridge; prefer Docker proxy/control-plane for WSL agents.",
  },
  {
    id: "legacy-monolith-path",
    label: "Legacy monolith path",
    severity: "WARN",
    pattern: /C:\\Users\\s\.poklad\\Documents\\Codex\\2026-07-08/i,
    detail: "Hardcoded monolith path; keep as fallback or replace with active D:/theseus-* project path.",
  },
  {
    id: "windows-absolute-path",
    label: "Windows absolute path",
    severity: "INFO",
    pattern: /[A-Z]:\\/,
    detail: "Windows path needs an explicit WSL mapping before runtime migration.",
  },
  {
    id: "wsl-bridge",
    label: "WSL bridge",
    severity: "INFO",
    pattern: /\bwsl(?:\.exe)?\b/i,
    detail: "Task already crosses into WSL; verify cwd, env, and path mapping.",
  },
  {
    id: "powershell-route",
    label: "PowerShell route",
    severity: "WARN",
    pattern: /\bpowershell(?:\.exe)?\b|\bpwsh(?:\.exe)?\b/i,
    detail: "PowerShell-sensitive route; prefer Node/WSL wrapper when repeated.",
  },
  {
    id: "direct-shell-string",
    label: "Direct shell string",
    severity: "INFO",
    pattern: /\bssh\b.+['"]|&&|\|\||\|/,
    detail: "Inline shell pipeline/string; promote to wrapper if it becomes important.",
  },
];

function taskCommand(task) {
  const args = Array.isArray(task.args) ? task.args.join(" ") : "";
  return [task.command || "", args].filter(Boolean).join(" ").trim();
}

function groupTask(task) {
  const label = task.label || "";
  const command = taskCommand(task);
  const text = `${label} ${command}`;
  const group = GROUPS.find(([, , pattern]) => pattern.test(text));
  return group ? group[0] : "other";
}

function groupLabel(id) {
  const group = GROUPS.find(([groupId]) => groupId === id);
  return group ? group[1] : "Other";
}

function taskKind(task) {
  const label = task.label || "";
  const command = taskCommand(task);
  const text = `${label} ${command}`;
  if (/status|health|ps|list|scan|lint|check|smoke|inventory|verify/i.test(text)) return "check";
  if (/advisor|council|bothub|codewhale/i.test(text)) return "advisor";
  if (/commit|backup|start|up|build|sync|apply|ingest|load|generate/i.test(text)) return "action";
  return "tool";
}

function routeHint(task) {
  const command = taskCommand(task);
  if (task.type === "shell") return "shell route";
  if (/docker\b/i.test(command)) return "Docker route";
  if (/node\b/i.test(command)) return "Node wrapper";
  if (/infisical/i.test(command)) return "Keychain route";
  if (/ssh\b/i.test(command)) return "SSH route";
  return task.type || "task";
}

function taskCapabilities(task) {
  const text = `${task.label || ""} ${task.command || ""} ${task.group_label || ""} ${task.route_hint || ""}`;
  return CAPABILITIES.filter(([, , pattern]) => pattern.test(text)).map(([id]) => id);
}

function taskPortabilityMarkers(task) {
  const text = JSON.stringify(task);
  return PORTABILITY_MARKERS.filter((marker) => marker.pattern.test(text)).map(({ id, label, severity, detail }) => ({
    id,
    label,
    severity,
    detail,
  }));
}

function portabilityStatus(markers) {
  if (markers.some((marker) => marker.severity === "FAIL")) return "FAIL";
  if (markers.some((marker) => marker.severity === "WARN")) return "WARN";
  return "OK";
}

function taskRisk(task) {
  if (task.kind === "check") return 1;
  if (task.kind === "advisor" || task.kind === "tool") return 2;
  if (/commit|push|load|ingest|sync|apply|generate|start|up|build/i.test(task.label)) return 4;
  return task.kind === "action" ? 3 : 2;
}

export function buildTaskCatalog() {
  const raw = JSON.parse(readFileSync(path.join(repoRoot, ".vscode", "tasks.json"), "utf8"));
  const tasks = (raw.tasks || []).map((task, index) => {
    const group = groupTask(task);
    const normalized = {
      id: `task-${index}`,
      label: task.label || `Task ${index + 1}`,
      type: task.type || "unknown",
      group,
      group_label: groupLabel(group),
      kind: taskKind(task),
      route_hint: routeHint(task),
      command: taskCommand(task),
      problem_matcher: Array.isArray(task.problemMatcher) ? task.problemMatcher.length : task.problemMatcher ? 1 : 0,
      has_inputs:
        /\$\{input:/.test(JSON.stringify(task.args || [])) ||
        /\$\{input:/.test(String(task.command || "")),
    };
    normalized.capabilities = taskCapabilities(normalized);
    normalized.portability_markers = taskPortabilityMarkers(task);
    normalized.portability_status = portabilityStatus(normalized.portability_markers);
    normalized.risk = taskRisk(normalized);
    return normalized;
  });

  const groups = [...new Set([...GROUPS.map(([id]) => id), "other"])]
    .map((id) => {
      const items = tasks.filter((task) => task.group === id);
      return {
        id,
        label: groupLabel(id),
        count: items.length,
        checks: items.filter((task) => task.kind === "check").length,
        actions: items.filter((task) => task.kind === "action").length,
        advisors: items.filter((task) => task.kind === "advisor").length,
      };
    })
    .filter((group) => group.count > 0);

  return {
    generated_at: new Date().toISOString(),
    total: tasks.length,
    groups,
    tasks,
  };
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/iu)
    .filter((token) => token.length >= 3);
}

function textScore(task, tokens) {
  if (tokens.length === 0) return 0;
  const haystack = `${task.label} ${task.command} ${task.group_label} ${task.route_hint} ${task.capabilities.join(" ")}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0) / tokens.length;
}

function routeScore(task, goal) {
  const tokens = tokenize(goal);
  const match = textScore(task, tokens);
  const kindBonus = task.kind === "check" ? 0.25 : task.kind === "advisor" ? 0.1 : 0;
  const inputPenalty = task.has_inputs ? 0.08 : 0;
  const riskPenalty = task.risk * 0.035;
  const portabilityPenalty = task.portability_status === "WARN" ? 0.07 : task.portability_status === "FAIL" ? 0.2 : 0;
  return Math.max(0, match + kindBonus - inputPenalty - riskPenalty - portabilityPenalty);
}

export function rankTaskRoutes(goal = "", limit = 8) {
  const catalog = buildTaskCatalog();
  const ranked = catalog.tasks
    .map((task) => ({
      ...task,
      score: Number(routeScore(task, goal).toFixed(3)),
      why: [
        task.kind === "check" ? "safe preflight" : null,
        task.has_inputs ? "needs input" : "no input",
        task.portability_status !== "OK" ? `portability ${task.portability_status}` : null,
        `${task.route_hint}`,
        task.capabilities.length ? `touches ${task.capabilities.join(", ")}` : null,
      ].filter(Boolean),
    }))
    .filter((task) => task.score > 0 || !goal)
    .sort((a, b) => b.score - a.score || a.risk - b.risk || a.label.localeCompare(b.label))
    .slice(0, limit);

  return {
    generated_at: new Date().toISOString(),
    goal,
    count: ranked.length,
    routes: ranked,
  };
}

function bundleTaskScore(task, bundle) {
  const overlap = task.capabilities.filter((capability) => bundle.capabilities.includes(capability)).length;
  const checkBonus = task.kind === "check" ? 2 : task.kind === "tool" ? 1 : 0;
  const inputPenalty = task.has_inputs ? 1 : 0;
  return overlap * 3 + checkBonus - task.risk - inputPenalty;
}

export function buildPreflightBundles() {
  const catalog = buildTaskCatalog();
  return {
    generated_at: new Date().toISOString(),
    bundles: PREFLIGHT_BUNDLES.map((bundle) => {
      const tasks = catalog.tasks
        .map((task) => ({ ...task, bundle_score: bundleTaskScore(task, bundle) }))
        .filter((task) => task.bundle_score > 0)
        .sort((a, b) => b.bundle_score - a.bundle_score || a.risk - b.risk || a.label.localeCompare(b.label))
        .slice(0, 6)
        .map((task) => ({
          id: task.id,
          label: task.label,
          kind: task.kind,
          risk: task.risk,
          route_hint: task.route_hint,
          capabilities: task.capabilities,
          score: task.bundle_score,
        }));
      return { ...bundle, tasks };
    }),
  };
}

export function buildTaskGraph(goal = "") {
  const catalog = buildTaskCatalog();
  const bundles = buildPreflightBundles().bundles;
  const recommendations = rankTaskRoutes(goal, 10).routes;
  const recommendedIds = new Set(recommendations.map((task) => task.id));
  const nodes = [];
  const edges = [];

  for (const group of catalog.groups) {
    nodes.push({ id: `group:${group.id}`, label: group.label, type: "group", count: group.count, weight: group.count });
  }
  for (const [id, label] of CAPABILITIES.map(([id, label]) => [id, label])) {
    const count = catalog.tasks.filter((task) => task.capabilities.includes(id)).length;
    if (count > 0) nodes.push({ id: `cap:${id}`, label, type: "capability", count, weight: count });
  }
  for (const marker of PORTABILITY_MARKERS) {
    const count = catalog.tasks.filter((task) => task.portability_markers.some((candidate) => candidate.id === marker.id)).length;
    if (count > 0) {
      nodes.push({
        id: `marker:${marker.id}`,
        label: marker.label,
        type: "marker",
        severity: marker.severity,
        count,
        weight: marker.severity === "WARN" ? 4 : 2,
      });
    }
  }
  for (const bundle of bundles) {
    nodes.push({ id: `bundle:${bundle.id}`, label: bundle.label, type: "bundle", count: bundle.tasks.length, weight: 4 });
    for (const capability of bundle.capabilities) {
      edges.push({ source: `bundle:${bundle.id}`, target: `cap:${capability}`, type: "covers", weight: 2 });
    }
  }
  for (const task of catalog.tasks) {
    nodes.push({
      id: task.id,
      label: task.label,
      type: "task",
      group: task.group,
      kind: task.kind,
      risk: task.risk,
      route_hint: task.route_hint,
      recommended: recommendedIds.has(task.id),
      portability_status: task.portability_status,
      portability_markers: task.portability_markers,
      weight: recommendedIds.has(task.id) ? 5 : 1,
    });
    edges.push({ source: `group:${task.group}`, target: task.id, type: "contains", weight: 1 });
    for (const capability of task.capabilities) {
      edges.push({ source: task.id, target: `cap:${capability}`, type: "touches", weight: task.kind === "check" ? 2 : 1 });
    }
    for (const marker of task.portability_markers) {
      edges.push({ source: task.id, target: `marker:${marker.id}`, type: "has-marker", weight: marker.severity === "WARN" ? 3 : 1 });
    }
  }
  for (const bundle of bundles) {
    for (const task of bundle.tasks.slice(0, 4)) {
      edges.push({ source: `bundle:${bundle.id}`, target: task.id, type: "preflights-with", weight: 2 });
    }
  }

  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + edge.weight);
    degree.set(edge.target, (degree.get(edge.target) || 0) + edge.weight);
  }

  return {
    generated_at: new Date().toISOString(),
    goal,
    nodes: nodes.map((node) => ({ ...node, degree: degree.get(node.id) || 0 })),
    edges,
    recommendations,
    metrics: {
      nodes: nodes.length,
      edges: edges.length,
      groups: catalog.groups.length,
      tasks: catalog.total,
      capabilities: nodes.filter((node) => node.type === "capability").length,
      bundles: bundles.length,
      markers: nodes.filter((node) => node.type === "marker").length,
      flagged_tasks: catalog.tasks.filter((task) => task.portability_status !== "OK").length,
      wsl_ready_tasks: catalog.tasks.filter((task) => task.portability_status === "OK").length,
    },
  };
}

function writeSnapshot(mode, payload) {
  const outDir = path.join(repoRoot, "outputs", "task_graph");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${mode}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(payload, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const write = argv.includes("--write");
  const clean = argv.filter((arg) => arg !== "--write");
  const [mode = "catalog", ...rest] = clean;
  const goal = rest.join(" ");
  const payload =
    mode === "graph"
      ? buildTaskGraph(goal)
      : mode === "rank"
        ? rankTaskRoutes(goal)
        : mode === "bundles"
          ? buildPreflightBundles()
          : buildTaskCatalog();
  if (write) writeSnapshot(mode, payload);
  console.log(JSON.stringify(payload, null, 2));
}
