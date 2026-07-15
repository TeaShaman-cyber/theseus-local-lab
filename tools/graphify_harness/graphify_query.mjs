#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env, exit, stderr } from "node:process";
import { fileURLToPath } from "node:url";

import { createProgressReporter } from "../progress/progress.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "graphify_harness");
const venvDir = env.GRAPHIFY_VENV || path.join(repoRoot, "work", "graphify-pilot", "venv-codex");
const graphifyExe = path.join(
  venvDir,
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "graphify.exe" : "graphify",
);
const reporter = createProgressReporter({ operation: "graphify_query" });

function parseArgs(argv) {
  const args = {
    profile: env.GRAPHIFY_PROFILE || "harness",
    command: "query",
    budget: "1200",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--profile") args.profile = argv[++i];
    else if (item === "--command") args.command = argv[++i];
    else if (item === "--budget") args.budget = argv[++i];
    else if (item === "--from") args.from = argv[++i];
    else if (item === "--to") args.to = argv[++i];
    else if (!args.query) args.query = item;
  }
  return args;
}

function fail(message, details = {}) {
  stderr.write(`${JSON.stringify({ event: "graphify_query_error", status: "failed", message, ...details })}\n`);
  console.error(JSON.stringify({ status: "failed", message, ...details }, null, 2));
  exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || "",
  };
}

function latestProfile(profile) {
  const latestPath = path.join(outputDir, `latest_${profile}.json`);
  if (!existsSync(latestPath)) {
    fail("Graphify profile summary is missing; build the profile first", {
      profile,
      expected: latestPath,
    });
  }
  const latest = JSON.parse(readFileSync(latestPath, "utf8"));
  if (!latest.graph_path || !existsSync(latest.graph_path)) {
    fail("Graphify graph is missing; rebuild the profile", {
      profile,
      graph_path: latest.graph_path || null,
    });
  }
  return latest;
}

function graphifyArgs(args, graphPath) {
  if (args.command === "query") {
    if (!args.query) fail("Missing query text");
    return ["query", args.query, "--graph", graphPath, "--budget", args.budget];
  }
  if (args.command === "explain") {
    if (!args.query) fail("Missing node name for explain");
    return ["explain", args.query, "--graph", graphPath];
  }
  if (args.command === "path") {
    if (!args.from || !args.to) fail("Missing --from or --to for path");
    return ["path", args.from, args.to, "--graph", graphPath];
  }
  fail("Unsupported Graphify command", { command: args.command, supported: ["query", "explain", "path"] });
}

function writeQuerySummary({ args, latest, result }) {
  mkdirSync(outputDir, { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    profile: latest.profile,
    command: args.command,
    query: args.query || null,
    from: args.from || null,
    to: args.to || null,
    graph_path: latest.graph_path,
    status: result.ok ? "ok" : "failed",
    stdout: result.stdout,
    stderr: result.stderr || result.error,
  };
  const jsonPath = path.join(outputDir, `latest_query_${args.profile}.json`);
  const mdPath = path.join(outputDir, `latest_query_${args.profile}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  const title =
    args.command === "path"
      ? `path ${args.from} -> ${args.to}`
      : `${args.command} ${args.query}`;
  writeFileSync(
    mdPath,
    `# Graphify Query\n\nGenerated: ${payload.generated_at}\n\n- Profile: ${args.profile}\n- Command: ${title}\n- Status: ${payload.status}\n\n\`\`\`text\n${result.stdout.trim() || result.stderr.trim() || result.error}\n\`\`\`\n`,
  );
  return { jsonPath, mdPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const latest = latestProfile(args.profile);
  if (!existsSync(graphifyExe)) {
    fail("Graphify executable is missing; run the build task first", { graphifyExe });
  }
  const commandArgs = graphifyArgs(args, latest.graph_path);
  reporter.heartbeat("query", `graphify ${commandArgs.join(" ")}`, { profile: args.profile, command: args.command });
  const result = run(graphifyExe, commandArgs);
  const summary = writeQuerySummary({ args, latest, result });
  if (!result.ok) fail("Graphify query failed", { code: result.code, stderr: result.stderr || result.error, ...summary });
  reporter.done("Graphify query completed", { profile: args.profile, summary: summary.mdPath });
  console.log(JSON.stringify({ status: "ok", profile: args.profile, ...summary }, null, 2));
}

main();
