#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const catalogPath = fileURLToPath(new URL("./catalog.json", import.meta.url));
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

const args = process.argv.slice(2);
const goalIndex = args.indexOf("--goal");
if (goalIndex === -1 || !args[goalIndex + 1]) {
  console.error("Usage: node tools/plugin_conclave/plugin_conclave.mjs --goal \"<task>\"");
  process.exit(1);
}

const goal = args[goalIndex + 1].toLowerCase();
const scored = catalog.routes
  .map((route) => ({
    ...route,
    matched: route.keywords.filter((keyword) => goal.includes(keyword)),
  }))
  .filter((route) => route.matched.length > 0)
  .sort((left, right) => right.matched.length - left.matched.length || left.id.localeCompare(right.id));

const recommendation = scored[0] ?? {
  id: "no-plugin-needed",
  primary: "local-evidence",
  corroborator: null,
  output: "use local evidence first; choose a plugin only after naming the external information gap",
  matched: [],
};

console.log(JSON.stringify({
  schema: catalog.schema,
  goal,
  recommendation,
  alternatives: scored.slice(1, 3).map(({ id, primary, corroborator, matched }) => ({ id, primary, corroborator, matched })),
  guardrails: catalog.principles,
}, null, 2));
