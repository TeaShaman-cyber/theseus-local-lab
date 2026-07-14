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

export function buildTaskCatalog() {
  const raw = JSON.parse(readFileSync(path.join(repoRoot, ".vscode", "tasks.json"), "utf8"));
  const tasks = (raw.tasks || []).map((task, index) => ({
    id: `task-${index}`,
    label: task.label || `Task ${index + 1}`,
    type: task.type || "unknown",
    group: groupTask(task),
    group_label: groupLabel(groupTask(task)),
    kind: taskKind(task),
    route_hint: routeHint(task),
    command: taskCommand(task),
    problem_matcher: Array.isArray(task.problemMatcher) ? task.problemMatcher.length : task.problemMatcher ? 1 : 0,
    has_inputs:
      /\$\{input:/.test(JSON.stringify(task.args || [])) ||
      /\$\{input:/.test(String(task.command || "")),
  }));

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(buildTaskCatalog(), null, 2));
}
