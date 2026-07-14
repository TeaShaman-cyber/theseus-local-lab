#!/usr/bin/env node
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

const safeWrappers = [
  /^node\s+hooks[\\/]hook-router\.mjs\b/i,
  /^node\s+tools[\\/]git_safety[\\/]scan_staged\.mjs\b/i,
  /^node\s+tools[\\/]git_safety[\\/]commit_checkpoint\.mjs\b/i,
  /^node\s+tools[\\/]memory_hook[\\/]memory_hook\.mjs\b/i,
  /^node\s+tools[\\/]provider_scout[\\/]provider_scout\.mjs\b/i,
  /^node\s+tools[\\/]research_queue[\\/]enqueue\.mjs\b/i,
  /^node\s+tools[\\/]research_queue[\\/]list\.mjs\b/i,
  /^node\s+tools[\\/]harness_errors[\\/]harness_errors\.mjs\b/i,
  /^node\s+tools[\\/]codex_system_watch[\\/]codex_system_watch\.mjs\b/i,
  /^node\s+tools[\\/]github_issue_watch[\\/]github_issue_watch\.mjs\b/i,
  /^node\s+tools[\\/]progress[\\/]progress_audit\.mjs\b/i,
  /^node\s+tools[\\/]sysinternals_scout[\\/]install_sysinternals\.mjs\b/i,
  /^node\s+tools[\\/]sysinternals_scout[\\/]sysinternals_scout\.mjs\b/i,
  /^node\s+tools[\\/]codex_windows_map[\\/]codex_windows_map\.mjs\b/i,
  /^node\s+tools[\\/]learning_loop[\\/]learning_loop\.mjs\b/i,
  /^node\s+tools[\\/]service_status[\\/]service_status\.mjs\b/i,
  /^node\s+tools[\\/]session_timeline[\\/]timeline\.mjs\b/i,
  /^node\s+tools[\\/]model_switch_guard[\\/]model_switch_guard\.mjs\b/i,
  /^node\s+tools[\\/]usage_scout[\\/]usage_scout\.mjs\b/i,
  /^node\s+tools[\\/]ocr_lens[\\/]ocr_lens\.mjs\b/i,
  /^node\s+tools[\\/]tool_policy[\\/]route_ranker\.mjs\b/i,
  /^node\s+tools[\\/]vscode_bridge[\\/]bridge\.mjs\b/i,
  /^node\s+tools[\\/]workshop_dashboard[\\/]dashboard\.mjs\b/i,
  /^node\s+tools[\\/]workshop_dashboard[\\/]smoke\.mjs\b/i,
  /^node\s+tools[\\/]docker_control_plane[\\/](direct_bridge|bridge|smoke_direct_bridge)\.mjs\b/i,
];

const safeGit = [
  /^git\s+status(\s|$)/i,
  /^git\s+diff(\s|$)/i,
  /^git\s+log(\s|$)/i,
  /^git\s+show(\s|$)/i,
];

function normalize(command) {
  return String(command || "").trim().replace(/\s+/g, " ");
}

function includesAny(text, words) {
  const haystack = String(text || "").toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function reinforcementFor(verdict, reason) {
  if (verdict === "block") {
    return {
      kind: "friction",
      score: -2,
      message: `Blocked risky route: ${reason}. Choose a safer project route.`,
    };
  }

  if (verdict === "allow" && reason === "known-safe-wrapper") {
    return {
      kind: "reward",
      score: 2,
      message: "Good route: known Theseus wrapper. This is the pattern to repeat.",
    };
  }

  if (verdict === "allow") {
    return {
      kind: "reward",
      score: 1,
      message: "Allowed low-risk route.",
    };
  }

  return {
    kind: "neutral",
    score: 0,
    message: "Caution route: proceed only if this does not become a repeated habit.",
  };
}

function decision(verdict, reason, message, routes = []) {
  return { verdict, reason, message, routes, reinforcement: reinforcementFor(verdict, reason) };
}

export function evaluateAction(action = {}) {
  const surface = String(action.surface || "shell").toLowerCase();
  const command = normalize(action.command);

  if (!command) {
    return decision("block", "empty-command", "Tool policy needs a concrete command or route before acting.", [
      "Name the intended VS Code task, MCP tool, or Node wrapper.",
    ]);
  }

  if (surface !== "shell") {
    return decision("allow", "non-shell-surface", "Non-shell action; apply the native tool's own permission model.");
  }

  if (safeWrappers.some((pattern) => pattern.test(command))) {
    return decision("allow", "known-safe-wrapper", "Known Theseus wrapper route.");
  }

  if (safeGit.some((pattern) => pattern.test(command))) {
    return decision("allow", "safe-git-read", "Read-only Git inspection is allowed.");
  }

  if (/\bnode(\.exe)?\s+-\s*<<|<<['"]?[A-Z0-9_-]+['"]?/i.test(command)) {
    return decision("block", "powershell-heredoc-antipattern", "Unix heredoc syntax is blocked in the Windows/PowerShell agent path.", [
      "Use node -e for short JavaScript checks.",
      "Promote longer logic into a small checked-in .mjs wrapper.",
      "Use WSL bash only as an explicit route, not by pasting heredoc into PowerShell.",
    ]);
  }

  if (/^wsl(\.exe)?\s+bash\s+-lc\b/i.test(command) && /\bjq\b/i.test(command)) {
    return decision(
      "block",
      "nested-shell-json-parser",
      "Nested PowerShell-to-WSL JSON parsing is blocked because quoting failures are hard to observe and repeat.",
      [
        "Use a small checked-in Node wrapper for JSON or JSONL parsing.",
        "Run a checked-in shell script directly inside WSL when Unix tooling is genuinely required.",
        "Keep PowerShell as a thin launcher only.",
      ],
    );
  }

  if (/^git\s+add\s+(-A|--all|\.)(\s|$)/i.test(command)) {
    return decision("block", "broad-git-stage", "Broad Git staging is blocked; stage explicit paths after scope review.", [
      "Use VS Code Source Control for explicit file selection.",
      "Use a narrow git add path only after inspecting the diff.",
      "Run node tools/git_safety/scan_staged.mjs before commit.",
    ]);
  }

  if (/^docker(\.exe)?\s/i.test(command) || /\bdocker\s+compose\b/i.test(command)) {
    return decision("block", "raw-docker-shell", "Raw Docker shell commands are blocked in the agent path; use Docker MCP or a VS Code task.", [
      "Use Docker MCP tool theseus_docker when available.",
      "Use VS Code task Theseus Docker TCP: ps for container listing.",
      "Use VS Code task Theseus AutoMem Graph Viewer: status for graph-viewer checks.",
      "Use tools/docker_control_plane/direct_bridge.mjs for allowlisted MCP access.",
    ]);
  }

  if (/^(powershell|pwsh)(\.exe)?\s/i.test(command) || /\.ps1\b/i.test(command)) {
    return decision("block", "raw-powershell-script", "Raw PowerShell script execution is blocked; use a VS Code task or Node wrapper.", [
      "Prefer an existing Theseus:* VS Code task.",
      "Move repeatable logic into a small Node wrapper.",
      "If PowerShell is unavoidable, make it a thin VS Code task with a clear checkpoint.",
    ]);
  }

  if (/[;&|]\s*(Remove-Item|del|erase|rmdir|rd)\b/i.test(command) || /^(Remove-Item|del|erase|rmdir|rd)\b/i.test(command)) {
    return decision("block", "destructive-filesystem", "Destructive filesystem commands require an explicit, reviewed wrapper.", [
      "Inspect target paths first.",
      "Use a purpose-built script with path containment checks.",
    ]);
  }

  if (/(^|\s)(curl|Invoke-WebRequest|iwr|wget)\s/i.test(command)) {
    return decision("warn", "direct-network-call", "Direct network calls are allowed only when no connector or project wrapper fits.", [
      "Prefer browser/connectors for public research.",
      "Prefer project smoke wrappers for provider checks.",
    ]);
  }

  return decision("warn", "unclassified-shell", "Unclassified shell command; prefer a project wrapper if this becomes repeated.", [
    "If repeated twice, codify it as a VS Code task or Node wrapper.",
  ]);
}

function scoreTaskFit(goal, route, policy) {
  const text = `${goal} ${route.command || ""} ${route.surface || ""}`;
  const command = normalize(route.command);

  if (includesAny(goal, ["docker", "container", "containers", "compose", "logs", "automem logs"])) {
    if (String(route.surface || "").toLowerCase() === "mcp" && includesAny(command, ["docker", "theseus_docker"])) return 3;
    if (String(route.surface || "").toLowerCase() === "vscode-task" && includesAny(command, ["docker", "automem logs"])) return 2;
    if (policy.reason === "known-safe-wrapper" && !includesAny(command, ["docker_control_plane"])) return -2;
    if (policy.reason === "raw-docker-shell") return 1;
  }

  if (includesAny(goal, ["memory", "checkpoint", "compact", "handoff"])) {
    if (includesAny(command, ["memory_hook"])) return 2;
    if (policy.reason === "raw-powershell-script") return -1;
  }

  if (includesAny(goal, ["secret", "scan", "staged", "commit"])) {
    if (includesAny(command, ["git_safety", "scan_staged", "commit_checkpoint"])) return 2;
  }

  if (includesAny(goal, ["skill", "skills", "route", "routing", "minimal"])) {
    if (includesAny(command, ["skill-router", "one matching skill", "minimal"])) return 3;
    if (includesAny(command, ["all project skills", "load all", "all skills"])) return -3;
  }

  if (includesAny(text, ["vscode", "task"])) return 1;
  if (policy.reason === "known-safe-wrapper") return 1;
  return 0;
}

function scoreRoute(goal, route) {
  const policy = evaluateAction(route);
  const surface = String(route.surface || "shell").toLowerCase();

  const scores = {
    safety: policy.verdict === "block" ? -3 : policy.verdict === "warn" ? 0 : 2,
    task_fit: scoreTaskFit(goal, route, policy),
    repeatability: ["mcp", "vscode-task"].includes(surface) || policy.reason === "known-safe-wrapper" ? 2 : 0,
    context_cost:
      policy.reason === "raw-powershell-script" ||
      policy.reason === "raw-docker-shell" ||
      includesAny(route.command, ["all project skills", "load all", "all skills"])
        ? -1
        : 1,
    user_friction: ["mcp", "vscode-task"].includes(surface) || policy.reason === "known-safe-wrapper" ? 1 : -1,
    verification_strength: includesAny(route.command, ["scan", "status", "ps", "logs", "health", "test"]) ? 1 : 0,
  };

  const total =
    scores.safety * 3 +
    scores.task_fit * 3 +
    scores.repeatability * 2 +
    scores.context_cost +
    scores.user_friction +
    scores.verification_strength;

  return {
    ...route,
    surface,
    policy,
    scores,
    total,
    final_reward: {
      status: "pending",
      score: Math.min(2, Math.max(-2, policy.reinforcement.score)),
      message: "Pending verification; do not treat route score as final reward.",
    },
  };
}

export function rankRoutes({ goal = "", candidates = [] } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("rankRoutes requires at least one candidate");
  }

  const ranked = candidates
    .map((candidate, index) => scoreRoute(goal, { id: candidate.id || `route-${index + 1}`, ...candidate }))
    .sort((a, b) => b.total - a.total || String(a.id).localeCompare(String(b.id)));

  return {
    goal,
    ranked,
    winner: ranked[0],
    notes: [
      "Scores are group-relative route selection hints, not final truth.",
      "Final reward must wait for verification outcome.",
    ],
  };
}

export function applyVerification(route, verification = {}) {
  const ok = Boolean(verification.ok);
  const base = Number(route?.final_reward?.score || 0);
  return {
    ...route,
    verification,
    final_reward: ok
      ? {
          status: "verified",
          score: Math.min(4, base + 2),
          message: verification.note || "Route verified successfully.",
        }
      : {
          status: "failed",
          score: -3,
          message: verification.note || "Route failed verification; do not reinforce.",
        },
  };
}

export function exitCodeFor(decisionResult) {
  if (decisionResult.verdict === "block") return 2;
  return 0;
}

async function logDecision(workspace, decisionResult, action) {
  const day = new Date().toISOString().slice(0, 10);
  const path = join(workspace, "outputs", "tool_policy", `${day}.jsonl`);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      action,
      decision: decisionResult,
    })}\n`,
  );
  await writeTimelineEvent(
    {
      source: "tool-policy",
      event: "tool-route-selected",
      note: `${decisionResult.verdict}: ${decisionResult.reason}`,
      tags: ["tool-policy", decisionResult.verdict, decisionResult.reason],
      metrics: {
        reinforcement_score: decisionResult.reinforcement?.score ?? 0,
      },
      artifacts: [relative(workspace, path)],
    },
    { workspace },
  );
}

function parseCli(argv) {
  const action = { surface: "shell", command: "" };
  let log = false;
  let noLog = false;
  const commandParts = [];

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--log") {
      log = true;
    } else if (item === "--no-log") {
      noLog = true;
    } else if (item === "--surface") {
      action.surface = argv[++i] || "";
    } else if (item === "--") {
      commandParts.push(...argv.slice(i + 1));
      break;
    } else {
      commandParts.push(item);
    }
  }

  action.command = commandParts.join(" ");
  return { action, log, noLog };
}

async function main() {
  const { action, log, noLog } = parseCli(process.argv.slice(2));
  const decisionResult = evaluateAction(action);
  const shouldLog = !noLog && (log || decisionResult.verdict === "block" || decisionResult.verdict === "warn");
  if (shouldLog) await logDecision(process.cwd(), decisionResult, action);
  console.log(JSON.stringify(decisionResult, null, 2));
  process.exitCode = exitCodeFor(decisionResult);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
