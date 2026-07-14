#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const GROUPS = [
  ["git", "Git & safety", /git|commit|staged|secret scan/i],
  ["memory", "Memory", /memory|automem|mempalace|compact|state packet/i],
  ["docker", "Docker & services", /docker|dashboard|graph viewer|log lattice|backup runner|keychain|secrets|tcp/i],
  ["observability", "Observability", /timeline|journal|harness|learning loop|workshop|observatory|status/i],
  ["advisors", "Advisors", /advisor|copilot|bothub|codewhale|council/i],
  ["vm", "VM & SSH", /vm|ssh|ubuntu|image transfer/i],
  ["research", "Research & data", /research|stra?zh|index|inventory|lint/i],
];

const CAPABILITIES = [
  ["git", "Git", /git|commit|staged|secret scan|push/i],
  ["memory", "Memory", /memory|automem|mempalace|compact|state packet/i],
  ["docker", "Docker", /docker|compose|container|image|tcp|graph viewer/i],
  ["secrets", "Secrets", /secret|keychain|infisical|providers env/i],
  ["backup", "Backup", /backup|mirror|archive/i],
  ["observability", "Observability", /status|health|timeline|journal|log lattice|dashboard|harness|learning loop/i],
  ["advisor", "Advisors", /advisor|copilot|bothub|council|codewhale/i],
  ["vm", "VM/SSH", /vm|ssh|ubuntu|image transfer/i],
  ["research", "Research", /research|stra?zh|index|inventory|observatory/i],
  ["lint", "Lint/check", /lint|check|scan|verify|smoke/i],
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
  if (/advisor|council|copilot|bothub|codewhale/i.test(text)) return "advisor";
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
  return Math.max(0, match + kindBonus - inputPenalty - riskPenalty);
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

export function buildTaskGraph(goal = "") {
  const catalog = buildTaskCatalog();
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
      weight: recommendedIds.has(task.id) ? 5 : 1,
    });
    edges.push({ source: `group:${task.group}`, target: task.id, type: "contains", weight: 1 });
    for (const capability of task.capabilities) {
      edges.push({ source: task.id, target: `cap:${capability}`, type: "touches", weight: task.kind === "check" ? 2 : 1 });
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
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode = "catalog", ...rest] = process.argv.slice(2);
  const goal = rest.join(" ");
  if (mode === "graph") console.log(JSON.stringify(buildTaskGraph(goal), null, 2));
  else if (mode === "rank") console.log(JSON.stringify(rankTaskRoutes(goal), null, 2));
  else console.log(JSON.stringify(buildTaskCatalog(), null, 2));
}
