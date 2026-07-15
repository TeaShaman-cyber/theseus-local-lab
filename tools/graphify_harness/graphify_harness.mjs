#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env, exit, stderr } from "node:process";
import { fileURLToPath } from "node:url";

import { createProgressReporter } from "../progress/progress.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const graphifyVersion = env.GRAPHIFY_VERSION || "0.9.16";
const graphifyPackage = `graphifyy==${graphifyVersion}`;
const pilotRoot = env.GRAPHIFY_PILOT_ROOT || path.resolve(repoRoot, "..", "graphify-theseus-pilot");
const outputDir = path.join(repoRoot, "outputs", "graphify_harness");
const venvDir = env.GRAPHIFY_VENV || path.join(repoRoot, "work", "graphify-pilot", "venv-codex");
const graphifyExe = path.join(venvDir, process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "graphify.exe" : "graphify");
const pythonExe = path.join(venvDir, process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
const profilesPath = path.join(here, "corpus_profiles.json");

const reporter = createProgressReporter({ operation: "graphify_harness" });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || env,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : "",
  };
}

function fail(message, details = {}) {
  const event = { status: "failed", message, ...details };
  stderr.write(`${JSON.stringify({ event: "graphify_harness_error", ...event })}\n`);
  console.error(JSON.stringify(event, null, 2));
  exit(1);
}

function parseArgs(argv) {
  const args = { ensure: true, profile: env.GRAPHIFY_PROFILE || "harness" };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--no-install") args.ensure = false;
    if (item === "--pilot-root") args.pilotRoot = argv[++i];
    if (item === "--profile") args.profile = argv[++i];
  }
  return args;
}

function loadProfile(name) {
  const profiles = JSON.parse(readFileSync(profilesPath, "utf8"));
  const profile = profiles[name];
  if (!profile) {
    fail("Unknown Graphify corpus profile", { profile: name, available: Object.keys(profiles) });
  }
  if (!Array.isArray(profile.items) || !profile.items.length) {
    fail("Graphify corpus profile has no items", { profile: name });
  }
  return { name, ...profile };
}

function candidatePythons() {
  const candidates = [];
  if (env.GRAPHIFY_PYTHON) candidates.push(env.GRAPHIFY_PYTHON);
  if (env.USERPROFILE) {
    candidates.push(
      path.join(
        env.USERPROFILE,
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "python",
        "python.exe",
      ),
    );
  }
  candidates.push("python3", "python");
  return candidates;
}

function pythonVersion(command) {
  const result = run(command, ["-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"]);
  if (!result.ok) return null;
  const version = result.stdout.trim();
  const [major, minor] = version.split(".").map((part) => Number(part));
  return { command, version, ok: major > 3 || (major === 3 && minor >= 10) };
}

function selectPython() {
  const tried = [];
  for (const candidate of candidatePythons()) {
    const version = pythonVersion(candidate);
    if (!version) {
      tried.push({ command: candidate, status: "unavailable" });
      continue;
    }
    tried.push(version);
    if (version.ok) return version;
  }
  fail("No Python >=3.10 route found for Graphify", { tried });
}

function ensureGraphify() {
  if (existsSync(graphifyExe)) {
    const version = run(graphifyExe, ["--version"]);
    if (version.ok) return { installed: true, reused: true, version: version.stdout.trim() };
  }

  const python = selectPython();
  reporter.heartbeat("venv", "creating isolated Graphify venv", { python: python.command, python_version: python.version });
  mkdirSync(path.dirname(venvDir), { recursive: true });
  const venv = run(python.command, ["-m", "venv", venvDir], { maxBuffer: 20 * 1024 * 1024 });
  if (!venv.ok) fail("Could not create Graphify venv", { code: venv.code, stderr: venv.stderr || venv.error });

  reporter.heartbeat("install", "installing Graphify package", { package: graphifyPackage });
  const pip = run(pythonExe, ["-m", "pip", "install", "--upgrade", "pip", graphifyPackage], {
    maxBuffer: 30 * 1024 * 1024,
  });
  if (!pip.ok) fail("Could not install Graphify package", { code: pip.code, stderr: pip.stderr || pip.error });

  const version = run(graphifyExe, ["--version"]);
  if (!version.ok) fail("Graphify installed but version check failed", { stderr: version.stderr || version.error });
  return { installed: true, reused: false, version: version.stdout.trim() };
}

function copyIntoCorpus(sourceRelative, corpusDir) {
  const source = path.join(repoRoot, sourceRelative);
  if (!existsSync(source)) return { source: sourceRelative, copied: false, reason: "missing" };
  const destination = path.join(corpusDir, sourceRelative);
  mkdirSync(path.dirname(destination), { recursive: true });
  if (sourceRelative.endsWith(".json") || sourceRelative.endsWith(".md")) copyFileSync(source, destination);
  else cpSync(source, destination, { recursive: true });
  return { source: sourceRelative, copied: true };
}

function buildCorpus(profile, corpusDir) {
  rmSync(corpusDir, { recursive: true, force: true });
  mkdirSync(corpusDir, { recursive: true });
  return profile.items.map((item) => copyIntoCorpus(item, corpusDir));
}

function readGraphStats(graphPath) {
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const relations = {};
  for (const edge of graph.edges || graph.links || []) {
    const relation = edge.relation || edge.label || edge.type || "unknown";
    relations[relation] = (relations[relation] || 0) + 1;
  }
  return {
    nodes: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    edges: Array.isArray(graph.edges) ? graph.edges.length : Array.isArray(graph.links) ? graph.links.length : 0,
    format: graph.edges ? "edges" : graph.links ? "links" : "unknown",
    relations,
  };
}

function runGraphify(args, phase) {
  reporter.heartbeat(phase, `graphify ${args.join(" ")}`);
  const result = run(graphifyExe, args, { maxBuffer: 20 * 1024 * 1024 });
  if (!result.ok) fail(`Graphify ${phase} failed`, { code: result.code, stderr: result.stderr || result.error });
  return result;
}

function writeSummary({ install, profile, copied, extract, query, explain, pathResult, diagnose, stats, corpusDir, graphPath }) {
  mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  const jsonPath = path.join(outputDir, `graphify_harness_${profile.name}_${stamp}.json`);
  const mdPath = path.join(outputDir, `graphify_harness_${profile.name}_${stamp}.md`);
  const latestJsonPath = path.join(outputDir, `latest_${profile.name}.json`);
  const latestMdPath = path.join(outputDir, `latest_${profile.name}.md`);
  const payload = {
    generated_at: new Date().toISOString(),
    profile: {
      name: profile.name,
      description: profile.description || "",
      items: profile.items,
    },
    graphify: install,
    pilot_root: pilotRoot,
    corpus_dir: corpusDir,
    graph_path: graphPath,
    copied,
    stats,
    smoke: {
      query: query.stdout,
      explain: explain.stdout,
      path: pathResult.stdout,
      diagnose: diagnose.stdout,
    },
    extract: {
      stdout: extract.stdout,
      stderr: extract.stderr,
    },
  };
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  const relationRows = Object.entries(stats.relations)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([relation, count]) => `- ${relation}: ${count}`)
    .join("\n");
  const md = `# Graphify Harness Lens\n\nGenerated: ${payload.generated_at}\n\n## Profile\n\n- Name: ${profile.name}\n- Description: ${profile.description || ""}\n\n## Result\n\n- Graphify: ${install.version}${install.reused ? " (reused venv)" : " (installed)"}\n- Nodes: ${stats.nodes}\n- Edges: ${stats.edges}\n- Graph format: ${stats.format}\n- Graph path: ${graphPath}\n\n## Relations\n\n${relationRows}\n\n## Smoke Query\n\n\`\`\`text\n${query.stdout.trim()}\n\`\`\`\n\n## Explain buildDashboard()\n\n\`\`\`text\n${explain.stdout.trim()}\n\`\`\`\n\n## Path buildDashboard() -> scan_staged.mjs\n\n\`\`\`text\n${pathResult.stdout.trim()}\n\`\`\`\n\n## Diagnose\n\n\`\`\`json\n${diagnose.stdout.trim()}\n\`\`\`\n`;
  writeFileSync(mdPath, md);
  writeFileSync(latestMdPath, md);
  return { jsonPath, mdPath, latestJsonPath, latestMdPath };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.pilotRoot) {
    fail("--pilot-root is reserved for a future version; use GRAPHIFY_PILOT_ROOT for now");
  }
  const profile = loadProfile(parsed.profile);
  const corpusDir = path.join(pilotRoot, profile.name, "corpus");
  const outRoot = path.join(pilotRoot, profile.name, "out");
  const graphDir = path.join(outRoot, "graphify-out");
  const graphPath = path.join(graphDir, "graph.json");
  reporter.heartbeat("start", "starting Graphify harness lens", { pilot_root: pilotRoot, profile: profile.name });
  const install = parsed.ensure ? ensureGraphify() : { installed: existsSync(graphifyExe), reused: true, version: "unknown" };
  if (!install.installed) fail("Graphify executable is missing and --no-install was set", { graphifyExe });

  reporter.heartbeat("corpus", "copying sanitized corpus", { profile: profile.name, items: profile.items.length });
  const copied = buildCorpus(profile, corpusDir);
  rmSync(outRoot, { recursive: true, force: true });

  const extract = runGraphify(["extract", corpusDir, "--code-only", "--out", outRoot, "--no-cluster"], "extract");
  const stats = readGraphStats(graphPath);
  const query = runGraphify(
    ["query", "what connects dashboard to git status", "--graph", graphPath, "--budget", "1200"],
    "query",
  );
  const explain = runGraphify(["explain", "buildDashboard()", "--graph", graphPath], "explain");
  const pathResult = runGraphify(["path", "buildDashboard()", "scan_staged.mjs", "--graph", graphPath], "path");
  const diagnose = runGraphify(["diagnose", "multigraph", "--graph", graphPath, "--json"], "diagnose");
  const summary = writeSummary({ install, profile, copied, extract, query, explain, pathResult, diagnose, stats, corpusDir, graphPath });
  reporter.done("Graphify harness lens completed", {
    nodes: stats.nodes,
    edges: stats.edges,
    summary: summary.mdPath,
    latest: summary.latestMdPath,
  });

  console.log(JSON.stringify({ status: "ok", nodes: stats.nodes, edges: stats.edges, ...summary }, null, 2));
}

main();
