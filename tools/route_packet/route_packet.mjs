#!/usr/bin/env node
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { rankRoutes } from "../tool_policy/tool_policy.mjs";
import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";

function normalizeSkill(skill) {
  return String(skill || "").trim().replace(/^.*[\\/]/, "").replace(/\.md$/i, "");
}

export function buildRoutePacket({ goal = "", skill = "", candidates = [] } = {}) {
  const selectedSkill = normalizeSkill(skill);
  if (!selectedSkill) throw new Error("route packet requires --skill");

  const ranking = rankRoutes({ goal, candidates });
  const winner = ranking.winner;
  return {
    version: 1,
    type: "theseus-route-packet",
    created_at: new Date().toISOString(),
    goal: ranking.goal,
    selected_skill: selectedSkill,
    next_action: {
      id: winner.id,
      surface: winner.surface,
      command: winner.command,
    },
    policy: winner.policy,
    verification: {
      status: "pending",
      required: true,
      note: "Route score is provisional until the selected action has an observable verification result.",
    },
    ranking: {
      candidates: ranking.ranked.map((route) => ({
        id: route.id,
        surface: route.surface,
        command: route.command,
        total: route.total,
        policy: route.policy,
      })),
      notes: ranking.notes,
    },
  };
}

function parseArgs(argv) {
  const result = { goal: "", skill: "", candidates: [], log: true };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--goal") result.goal = argv[++i] || "";
    else if (item === "--skill") result.skill = argv[++i] || "";
    else if (item === "--candidate") result.candidates.push({ command: argv[++i] || "" });
    else if (item === "--mcp") result.candidates.push({ surface: "mcp", command: argv[++i] || "" });
    else if (item === "--vscode-task") result.candidates.push({ surface: "vscode-task", command: argv[++i] || "" });
    else if (item === "--no-log") result.log = false;
    else throw new Error(`Unknown option: ${item}`);
  }
  return result;
}

async function writePacket(packet, workspace) {
  const day = new Date().toISOString().slice(0, 10);
  const path = join(workspace, "outputs", "route_packet", `${day}.jsonl`);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(packet)}\n`, "utf8");
  await writeTimelineEvent(
    {
      source: "route-packet",
      event: "skill-route-bound",
      note: `${packet.selected_skill} -> ${packet.next_action.surface}: ${packet.policy.verdict} (${packet.policy.reason})`,
      tags: ["route-packet", packet.selected_skill, packet.policy.verdict, packet.policy.reason],
      artifacts: [relative(workspace, path)],
      metrics: { route_score: packet.ranking.candidates.find((route) => route.id === packet.next_action.id)?.total ?? 0 },
    },
    { workspace },
  );
  return path;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packet = buildRoutePacket(args);
  if (args.log) packet.artifact = relative(process.cwd(), await writePacket(packet, process.cwd()));
  console.log(JSON.stringify(packet, null, 2));
  if (packet.policy.verdict === "block") process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
