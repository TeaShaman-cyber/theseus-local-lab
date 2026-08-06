#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const specPath = process.argv[2] || "gtd/planning-cycle.json";
const spec = JSON.parse(await readFile(specPath, "utf8"));
const states = new Set(spec.states);
const transitions = spec.transitions.map(([from, to]) => ({ from, to }));
const errors = [];

if (spec.schema !== "theseus.gtd.planning-cycle.v1") {
  errors.push(`unexpected schema: ${spec.schema}`);
}
if (!states.has(spec.entry)) errors.push(`entry is not declared: ${spec.entry}`);
if (!states.has(spec.terminal)) errors.push(`terminal is not declared: ${spec.terminal}`);

const seenEdges = new Set();
const adjacency = new Map([...states].map((state) => [state, []]));
for (const { from, to } of transitions) {
  if (!states.has(from)) errors.push(`unknown transition source: ${from}`);
  if (!states.has(to)) errors.push(`unknown transition target: ${to}`);
  const key = `${from}\u0000${to}`;
  if (seenEdges.has(key)) errors.push(`duplicate transition: ${from} -> ${to}`);
  seenEdges.add(key);
  adjacency.get(from)?.push(to);
}

const reachable = new Set([spec.entry]);
const queue = [spec.entry];
while (queue.length > 0) {
  const current = queue.shift();
  for (const next of adjacency.get(current) || []) {
    if (!reachable.has(next)) {
      reachable.add(next);
      queue.push(next);
    }
  }
}
for (const state of states) {
  if (!reachable.has(state)) errors.push(`unreachable state: ${state}`);
}

const visiting = new Set();
const visited = new Set();
function visit(state) {
  if (visiting.has(state)) return true;
  if (visited.has(state)) return false;
  visiting.add(state);
  for (const next of adjacency.get(state) || []) {
    if (visit(next)) return true;
  }
  visiting.delete(state);
  visited.add(state);
  return false;
}
if (visit(spec.entry)) errors.push("planning cycle must be acyclic");

const terminalReachable = reachable.has(spec.terminal);
const result = {
  schema: "theseus.gtd.state-canary.v1",
  status: errors.length === 0 ? "pass" : "fail",
  read_only: true,
  spec: specPath,
  checks: {
    schema: spec.schema === "theseus.gtd.planning-cycle.v1",
    entry_declared: states.has(spec.entry),
    terminal_declared: states.has(spec.terminal),
    all_transition_endpoints_declared: !errors.some((error) => error.startsWith("unknown transition")),
    no_duplicate_transitions: !errors.some((error) => error.startsWith("duplicate transition")),
    all_states_reachable_from_entry: [...states].every((state) => reachable.has(state)),
    planning_graph_acyclic: !errors.includes("planning cycle must be acyclic"),
    terminal_reachable: terminalReachable,
  },
  states: [...states],
  transitions,
  reachable: [...reachable],
  errors,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = errors.length === 0 ? 0 : 1;
