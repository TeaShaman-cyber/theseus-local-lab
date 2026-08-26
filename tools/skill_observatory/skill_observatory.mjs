#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "skill_observatory");
export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_COVERAGE_TARGET = 1 / GOLDEN_RATIO;
export const DEFAULT_PARETO_THRESHOLD = 0.8;

function parseArgs(argv) {
  const args = { mode: "audit", source: "manual", windowHours: 168, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "expect" || item === "audit") args.mode = item;
    else if (item === "--source") args.source = argv[++index] || args.source;
    else if (item === "--window-hours") args.windowHours = Number(argv[++index] || args.windowHours);
    else if (item === "--write") args.write = true;
    else if (item === "--quiet") args.quiet = true;
    else throw new Error(`Unknown option: ${item}`);
  }
  return args;
}

function readJsonlDirectory(relativeDir) {
  const directory = path.join(repoRoot, relativeDir);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      readFileSync(path.join(directory, name), "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        }),
    );
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function paretoFocus(counts, threshold = DEFAULT_PARETO_THRESHOLD, maxItems = 3) {
  const ranked = Object.entries(counts)
    .map(([id, count]) => ({ id, count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
  const total = ranked.reduce((sum, item) => sum + item.count, 0);
  let covered = 0;
  const focus = [];
  for (const item of ranked) {
    if (focus.length >= maxItems) break;
    focus.push({ ...item, cumulative_share: Number(((covered + item.count) / total).toFixed(3)) });
    covered += item.count;
    if (covered / total >= threshold) break;
  }
  return { total, threshold, focus, deferred: ranked.slice(focus.length) };
}

export function expectedSkills(rawInput) {
  const text = String(rawInput || "").toLowerCase();
  const has = (pattern) => pattern.test(text);
  const nonTrivial = text.length >= 80 || has(/automem|mempalace|docker|wsl|powershell|github|git|vscode|исслед|поищи|найди|памят|докер|виндовс|коммит|обсерватор/iu);
  if (!nonTrivial) return [];

  const skills = ["theseus-memory-stack"];
  if (has(/docker|wsl|powershell|pwsh|bash|shell|node|vscode|vs code|windows|контейнер|докер|терминал|скрипт|виндовс|ide/iu)) {
    skills.push("theseus-shell-routing", "local-agent-hygiene");
  }
  if (has(/\bgit\b|github|commit|push|pull request|репозитор|коммит|пуш/iu)) skills.push("theseus-git-hygiene");
  if (has(/research|search|internet|osint|найди|поищи|исслед|документац|best practice|issue|плагин/iu)) {
    skills.push("theseus-plugin-conclave");
  }
  return [...new Set(skills)];
}

function appendEvent(event) {
  mkdirSync(outputDir, { recursive: true });
  const filename = `${new Date().toISOString().slice(0, 10)}.jsonl`;
  appendFileSync(path.join(outputDir, filename), `${JSON.stringify(event)}\n`, "utf8");
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

function parseTimestamp(item) {
  const value = item.created_at || item.ts || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildAudit(windowHours) {
  const now = Date.now();
  const cutoff = now - Math.max(1, windowHours) * 3_600_000;
  const expectations = readJsonlDirectory("outputs/skill_observatory")
    .filter((item) => item.type === "skill-expectation" && parseTimestamp(item) >= cutoff);
  const packets = readJsonlDirectory("outputs/route_packet").filter((item) => parseTimestamp(item) >= cutoff);
  const policyEvents = readJsonlDirectory("outputs/tool_policy").filter((item) => parseTimestamp(item) >= cutoff);
  const selections = packets.map((packet) => ({
    created_at: packet.created_at,
    skill: packet.selected_skill || "unknown",
    surface: packet.next_action?.surface || "unknown",
    verdict: packet.policy?.verdict || "unknown",
    reason: packet.policy?.reason || "unknown",
  }));
  const incidents = policyEvents.filter((item) => ["warn", "block"].includes(item.decision?.verdict));
  const expectationCounts = countBy(expectations.flatMap((item) => item.expected_skills || []).map((skill) => ({ skill })), (item) => item.skill);
  const selectionCounts = countBy(selections, (item) => item.skill);
  const underused = Object.entries(expectationCounts)
    .filter(([skill, expected]) => skill !== "theseus-memory-stack" && expected >= 3 && !selectionCounts[skill])
    .map(([skill, expected]) => ({ skill, expected }));
  const incidentCounts = countBy(incidents, (item) => item.decision?.reason || "unknown");
  const recurringIncidents = Object.entries(incidentCounts)
    .filter(([, count]) => count >= 3)
    .map(([reason, count]) => ({ reason, count }));
  const pareto = paretoFocus(incidentCounts);
  const goldenConcentration = paretoFocus(incidentCounts, GOLDEN_COVERAGE_TARGET);
  const priorityQueue = [
    ...pareto.focus.map((item) => ({ id: `policy:${item.id}`, kind: "policy-incident", score: item.count * 10, count: item.count, coverage: item.cumulative_share })),
    ...underused.map((item) => ({ id: `skill:${item.skill}`, kind: "underused-skill", score: item.expected * 4, count: item.expected })),
  ]
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 3);
  const status = underused.length || recurringIncidents.length ? "WARN" : "OK";
  return {
    generated_at: new Date().toISOString(),
    status,
    window_hours: windowHours,
    privacy: "Stores only expected skill identifiers and observable route/policy events; no prompt text or hidden reasoning.",
    metrics: {
      expectations: expectations.length,
      route_packets: packets.length,
      policy_incidents: incidents.length,
      expectations_by_skill: expectationCounts,
      selections_by_skill: selectionCounts,
      selections_by_surface: countBy(selections, (item) => item.surface),
      selected_policy_verdicts: countBy(selections, (item) => item.verdict),
    },
    review_triggers: {
      underused_skills: underused,
      recurring_policy_incidents: recurringIncidents,
      review_when: "Review when a skill is expected at least 3 times in the window without a route packet, or a policy reason repeats 3 times.",
    },
    priority_policy: {
      method: "Pareto and phi coverage are mathematical concentration diagnostics, not proofs of causality or autonomous scoring rules.",
      thresholds: {
        pareto_baseline: DEFAULT_PARETO_THRESHOLD,
        note: "0.80 is a tunable comparison baseline, not an invariant. Reassess it against observed incident dynamics.",
      },
      focus_budget: 3,
      pareto_incidents: pareto,
      golden_ratio_diagnostic: {
        phi: Number(GOLDEN_RATIO.toFixed(6)),
        coverage_target: Number(GOLDEN_COVERAGE_TARGET.toFixed(6)),
        minimal_focus: goldenConcentration.focus,
        meaning: "Smallest bounded set of incident reasons covering at least 1/phi of observed incident mass; compare with the 80% Pareto focus before choosing work.",
      },
      priority_queue: priorityQueue,
      stop_condition: "Do not widen the harness until the highest-priority item has a causal hypothesis, a small reversible change, and a verification result. Defer lower-impact items.",
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "expect") {
    const expected = expectedSkills(await readStdin());
    const event = { type: "skill-expectation", created_at: new Date().toISOString(), source: args.source, expected_skills: expected };
    if (expected.length) appendEvent(event);
    if (!args.quiet) console.log(JSON.stringify({ recorded: expected.length > 0, expected_skills: expected }));
    return;
  }

  const report = buildAudit(args.windowHours);
  if (args.write) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!args.quiet) console.log(JSON.stringify(report, null, 2));
  if (report.status === "WARN") process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
