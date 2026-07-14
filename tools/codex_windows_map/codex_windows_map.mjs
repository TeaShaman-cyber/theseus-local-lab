#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { createProgressReporter } from "../progress/progress.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "codex_windows_map");
const snapshotDir = path.join(outputDir, "snapshots");
const compareFile = path.join(outputDir, "compare-latest.json");
const compareMarkdownFile = path.join(outputDir, "compare-latest.md");
const focusTerms = [
  "codex",
  "chatgpt",
  "openai",
  "node",
  "code.exe",
  "docker",
  "wsl",
  "vmmem",
  "v2ray",
];
const fileFocusTerms = [
  "\\codex",
  "\\chatgpt",
  "\\openai",
  "\\.codex",
  "\\windowsapps",
  "\\docker",
  "\\wsl",
  "\\microsoft",
  "\\tools\\sysinternals",
];
const sysinternalsDirs = [
  process.env.THESEUS_SYSINTERNALS_DIR,
  path.join(os.homedir(), "Tools", "Sysinternals"),
  "C:\\Tools\\Sysinternals",
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    command: "snapshot",
    write: false,
    format: "markdown",
    maxProcesses: 12,
    maxDllsPerProcess: 40,
    maxHandlesPerProcess: 40,
    refreshCaches: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "snapshot" || item === "compare") args.command = item;
    else if (item === "--write") args.write = true;
    else if (item === "--json") args.format = "json";
    else if (item === "--markdown") args.format = "markdown";
    else if (item === "--no-refresh") args.refreshCaches = false;
    else if (item === "--max-processes") args.maxProcesses = Number(argv[++i] || args.maxProcesses);
    else if (item === "--max-dlls") args.maxDllsPerProcess = Number(argv[++i] || args.maxDllsPerProcess);
    else if (item === "--max-handles") args.maxHandlesPerProcess = Number(argv[++i] || args.maxHandlesPerProcess);
  }
  args.maxProcesses = clampInt(args.maxProcesses, 1, 30, 12);
  args.maxDllsPerProcess = clampInt(args.maxDllsPerProcess, 0, 120, 40);
  args.maxHandlesPerProcess = clampInt(args.maxHandlesPerProcess, 0, 120, 40);
  return args;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function stamp(date = new Date()) {
  return date.toISOString().replaceAll(":", "").replace(/\.\d+Z$/, "Z");
}

function decodeOutput(buffer) {
  if (!buffer?.length) return "";
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  const sample = buffer.subarray(0, Math.min(buffer.length, 200));
  let zeroOdd = 0;
  for (let i = 1; i < sample.length; i += 2) {
    if (sample[i] === 0) zeroOdd += 1;
  }
  if (zeroOdd > sample.length / 6) return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd || repoRoot,
        env: options.env || process.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ ok: false, code: null, killed: false, stdout: "", stderr: error.message });
      return;
    }
    const stdout = [];
    const stderr = [];
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, options.timeoutMs || 12_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, killed, stdout: decodeOutput(Buffer.concat(stdout)), stderr: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !killed,
        code,
        killed,
        stdout: decodeOutput(Buffer.concat(stdout)),
        stderr: decodeOutput(Buffer.concat(stderr)),
      });
    });
  });
}

function httpsJson(url, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          "user-agent": "theseus-codex-windows-map",
          accept: "application/vnd.github+json, application/json",
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: JSON.parse(body) });
          } catch (error) {
            resolve({ ok: false, status: res.statusCode, error: error.message, excerpt: body.slice(0, 300) });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ ok: false, error: error.message }));
  });
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseTasklist(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCsvLine)
    .filter((row) => row.length >= 5)
    .map((row) => ({
      image: row[0] || "",
      pid: row[1] || "",
      session_name: row[2] || "",
      session_number: row[3] || "",
      memory: row[4] || "",
      status: row[5] || "",
      user: row[6] || "",
      cpu_time: row[7] || "",
      window_title: row.slice(8).join(",") || "",
    }));
}

function parseModuleRows(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCsvLine)
    .filter((row) => row.length >= 3)
    .flatMap((row) => String(row[2] || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function parseListDlls(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]:\\/i.test(line) || /^\\\\/.test(line))
    .slice(0, 200);
}

function parseHandle(stdout, maxItems) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => fileFocusTerms.some((term) => line.toLowerCase().includes(term)))
    .map((line) => line.replace(/\s+/g, " ").slice(0, 260))
    .slice(0, maxItems);
}

function parseNetstat(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(TCP|UDP)\s+/i.test(line))
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts[0]?.toUpperCase() === "TCP" && parts.length >= 5) {
        return {
          proto: "TCP",
          local: parts[1],
          foreign_class: classifyEndpoint(parts[2]),
          state: parts[3],
          pid: parts[4],
          local_port: portOf(parts[1]),
        };
      }
      if (parts[0]?.toUpperCase() === "UDP" && parts.length >= 4) {
        return {
          proto: "UDP",
          local: parts[1],
          foreign_class: classifyEndpoint(parts[2]),
          state: "UDP",
          pid: parts[3],
          local_port: portOf(parts[1]),
        };
      }
      return null;
    })
    .filter(Boolean);
}

function portOf(endpoint) {
  const match = String(endpoint || "").match(/:(\d+)$/);
  return match ? match[1] : "";
}

function classifyEndpoint(endpoint) {
  const value = String(endpoint || "").toLowerCase();
  if (!value || value === "*:*") return "any";
  if (value.includes("127.0.0.1") || value.includes("[::1]") || value.includes("localhost")) return "loopback";
  if (value.includes("0.0.0.0") || value.includes("[::]")) return "any";
  if (/^(\[?fe80:|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(value)) return "private-lan";
  return "external-or-system";
}

function isFocusedProcess(process) {
  const text = `${process.image} ${process.window_title} ${process.user}`.toLowerCase();
  return focusTerms.some((term) => text.includes(term));
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findSysinternalsTool(candidates) {
  for (const dir of sysinternalsDirs) {
    for (const candidate of candidates) {
      const filePath = path.join(dir, candidate);
      if (existsSync(filePath)) return filePath;
    }
  }
  return null;
}

async function refreshCache(toolPath, cachePath, progress, label) {
  progress.heartbeat("refresh-cache", `refreshing ${label}`);
  const result = await run(process.execPath, [toolPath, "--write", "--json"], { timeoutMs: 35_000 });
  if (result.ok) {
    try {
      return { ok: true, source: "fresh", data: JSON.parse(result.stdout) };
    } catch {
      return { ok: true, source: "cache-after-fresh", data: readJson(cachePath), parse_error: true };
    }
  }
  return {
    ok: false,
    source: existsSync(cachePath) ? "stale-cache" : "missing",
    data: readJson(cachePath),
    error: (result.stderr || result.stdout || "refresh failed").slice(0, 500),
  };
}

async function collectCaches(args, progress) {
  const caches = {};
  const specs = [
    ["codex_system", "tools/codex_system_watch/codex_system_watch.mjs", "outputs/codex_system_watch/codex-system.json"],
    ["github_issues", "tools/github_issue_watch/github_issue_watch.mjs", "outputs/github_issue_watch/openai-codex.json"],
    ["provider_scout", "tools/provider_scout/provider_scout.mjs", "outputs/provider_scout/provider-scout.json"],
    ["sysinternals_scout", "tools/sysinternals_scout/sysinternals_scout.mjs", "outputs/sysinternals_scout/sysinternals-scout.json"],
  ];
  for (const [key, tool, cache] of specs) {
    const toolPath = path.join(repoRoot, tool);
    const cachePath = path.join(repoRoot, cache);
    caches[key] = args.refreshCaches
      ? await refreshCache(toolPath, cachePath, progress, key)
      : { ok: existsSync(cachePath), source: "cache-only", data: readJson(cachePath) };
  }
  return caches;
}

async function collectGithubRepoContext() {
  const [repo, branch] = await Promise.all([
    httpsJson("https://api.github.com/repos/openai/codex"),
    httpsJson("https://api.github.com/repos/openai/codex/commits/main"),
  ]);
  return {
    ok: repo.ok && branch.ok,
    repo: repo.ok
      ? {
          full_name: repo.body.full_name,
          html_url: repo.body.html_url,
          description: repo.body.description,
          default_branch: repo.body.default_branch,
          pushed_at: repo.body.pushed_at,
          open_issues_count: repo.body.open_issues_count,
          stars: repo.body.stargazers_count,
        }
      : { error: repo.error || repo.status },
    main_commit: branch.ok
      ? {
          sha: branch.body.sha,
          date: branch.body.commit?.committer?.date,
          message: String(branch.body.commit?.message || "").split(/\r?\n/)[0],
          url: branch.body.html_url,
        }
      : { error: branch.error || branch.status },
  };
}

async function collectProcesses() {
  let tasklist = null;
  const [verboseTasklist, netstat] = await Promise.all([
    run("tasklist.exe", ["/fo", "csv", "/nh", "/v"], { timeoutMs: 12_000 }),
    run("netstat.exe", ["-ano"], { timeoutMs: 12_000 }),
  ]);
  tasklist = verboseTasklist;
  if (!tasklist.ok) {
    tasklist = await run("tasklist.exe", ["/fo", "csv", "/nh"], { timeoutMs: 12_000 });
    tasklist.fallback_from_verbose = true;
    tasklist.verbose_error = {
      code: verboseTasklist.code,
      killed: verboseTasklist.killed,
      stderr: verboseTasklist.stderr.slice(0, 300),
    };
  }
  const processes = tasklist.ok ? parseTasklist(tasklist.stdout) : [];
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const connections = netstat.ok ? parseNetstat(netstat.stdout) : [];
  const focusedPids = new Set(processes.filter(isFocusedProcess).map((process) => process.pid));
  for (const connection of connections) {
    if (focusedPids.has(connection.pid)) continue;
    const process = byPid.get(connection.pid);
    if (process && isFocusedProcess(process)) focusedPids.add(connection.pid);
  }
  const focused = [...focusedPids]
    .map((pid) => byPid.get(pid))
    .filter(Boolean)
    .sort((a, b) => a.image.localeCompare(b.image) || Number(a.pid) - Number(b.pid));
  return {
    commands: {
      tasklist: { ok: tasklist.ok, code: tasklist.code, killed: tasklist.killed, error: tasklist.ok ? null : tasklist.stderr.slice(0, 300) },
      tasklist_fallback_from_verbose: Boolean(tasklist.fallback_from_verbose),
      tasklist_verbose_error: tasklist.verbose_error || null,
      netstat: { ok: netstat.ok, code: netstat.code, killed: netstat.killed, error: netstat.ok ? null : netstat.stderr.slice(0, 300) },
    },
    processes,
    focused,
    connections,
  };
}

async function collectProcessDeepSamples(focusedProcesses, args, progress) {
  const listDlls = findSysinternalsTool(["listdlls64.exe", "listdlls.exe"]);
  const handle = findSysinternalsTool(["handle64.exe", "handle.exe"]);
  const samples = [];
  const selected = focusedProcesses.slice(0, args.maxProcesses);
  for (const process of selected) {
    progress.emit("process-sample", { image: process.image, pid: process.pid });
    const modules = args.maxDllsPerProcess
      ? await run("tasklist.exe", ["/m", "/fi", `PID eq ${process.pid}`, "/fo", "csv", "/nh"], { timeoutMs: 8_000 })
      : { ok: false, stdout: "", stderr: "disabled" };
    const listDllsResult = listDlls && args.maxDllsPerProcess
      ? await run(listDlls, ["-accepteula", process.pid], { timeoutMs: 8_000 })
      : { ok: false, stdout: "", stderr: listDlls ? "disabled" : "listdlls not found" };
    const handleResult = handle && args.maxHandlesPerProcess
      ? await run(handle, ["-nobanner", "-accepteula", "-p", process.pid], { timeoutMs: 8_000 })
      : { ok: false, stdout: "", stderr: handle ? "disabled" : "handle not found" };

    const dllNames = modules.ok ? parseModuleRows(modules.stdout).slice(0, args.maxDllsPerProcess) : [];
    const dllPaths = listDllsResult.ok ? parseListDlls(listDllsResult.stdout).slice(0, args.maxDllsPerProcess) : [];
    samples.push({
      pid: process.pid,
      image: process.image,
      window_title: process.window_title,
      dlls: {
        names: dllNames,
        paths: dllPaths,
        collection: {
          tasklist_modules_ok: modules.ok,
          listdlls_ok: listDllsResult.ok,
          listdlls_error: listDllsResult.ok ? null : (listDllsResult.stderr || listDllsResult.stdout || "").slice(0, 240),
        },
      },
      handles: {
        samples: handleResult.ok ? parseHandle(handleResult.stdout, args.maxHandlesPerProcess) : [],
        collection: {
          handle_ok: handleResult.ok,
          handle_error: handleResult.ok ? null : (handleResult.stderr || handleResult.stdout || "").slice(0, 240),
        },
      },
    });
  }
  return samples;
}

function addNode(nodes, node) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges, edge) {
  edges.push(edge);
}

function buildGraph({ processes, connections, deepSamples, caches, githubRepo }) {
  const nodes = new Map();
  const edges = [];

  addNode(nodes, { id: "system:windows", type: "system", label: "Windows host" });
  addNode(nodes, { id: "app:codex-desktop", type: "application", label: "Codex Desktop / ChatGPT Work" });
  addNode(nodes, { id: "repo:openai/codex", type: "github-repo", label: "openai/codex" });
  addNode(nodes, { id: "project:theseus-local-lab", type: "project", label: "Theseus local lab" });
  addEdge(edges, { source: "app:codex-desktop", target: "system:windows", relation: "runs-on" });
  addEdge(edges, { source: "project:theseus-local-lab", target: "app:codex-desktop", relation: "observes" });
  addEdge(edges, { source: "project:theseus-local-lab", target: "repo:openai/codex", relation: "watches-upstream" });

  const focused = processes.focused.slice(0, 40);
  for (const process of focused) {
    const processId = `process:${process.pid}`;
    addNode(nodes, {
      id: processId,
      type: "process",
      label: `${process.image} #${process.pid}`,
      image: process.image,
      pid: process.pid,
      status: process.status,
    });
    addEdge(edges, { source: processId, target: "system:windows", relation: "visible-process" });
    if (/codex|chatgpt|openai/i.test(`${process.image} ${process.window_title}`)) {
      addEdge(edges, { source: "app:codex-desktop", target: processId, relation: "process-candidate" });
    }
  }

  const focusedPids = new Set(focused.map((process) => process.pid));
  for (const connection of connections.filter((item) => focusedPids.has(item.pid)).slice(0, 140)) {
    const portId = `port:${connection.local_port || connection.local}`;
    const endpointId = `endpoint-class:${connection.foreign_class}`;
    addNode(nodes, { id: portId, type: "port", label: connection.local_port || connection.local });
    addNode(nodes, { id: endpointId, type: "endpoint-class", label: connection.foreign_class });
    addEdge(edges, { source: `process:${connection.pid}`, target: portId, relation: connection.state === "LISTENING" ? "listens-on" : "uses-local-port" });
    addEdge(edges, { source: portId, target: endpointId, relation: "talks-to" });
  }

  for (const sample of deepSamples) {
    const processId = `process:${sample.pid}`;
    for (const dll of sample.dlls.names.slice(0, 30)) {
      const dllId = `dll:${dll.toLowerCase()}`;
      addNode(nodes, { id: dllId, type: "dll", label: dll });
      addEdge(edges, { source: processId, target: dllId, relation: "loads-dll" });
    }
    for (const handle of sample.handles.samples.slice(0, 20)) {
      const handleId = `handle:${sample.pid}:${shortHash(handle)}`;
      addNode(nodes, { id: handleId, type: "file-handle", label: handle.slice(0, 80) });
      addEdge(edges, { source: processId, target: handleId, relation: "has-focused-handle" });
    }
  }

  const events = caches.codex_system?.data?.windows_events?.events || [];
  for (const event of events.slice(0, 20)) {
    const eventId = `event:${event.provider || "unknown"}:${event.event_id || "?"}:${event.record_id || shortHash(event.message_excerpt)}`;
    addNode(nodes, { id: eventId, type: "windows-event", label: `${event.provider || "event"} #${event.event_id || "?"}` });
    addEdge(edges, { source: "app:codex-desktop", target: eventId, relation: "matched-event" });
  }

  const issues = caches.github_issues?.data?.issues || [];
  for (const issue of issues.filter((item) => item.high_signal || item.is_new || item.recently_updated).slice(0, 24)) {
    const issueId = `issue:${issue.number}`;
    addNode(nodes, { id: issueId, type: "github-issue", label: `#${issue.number} ${issue.title}`, url: issue.url });
    addEdge(edges, { source: "repo:openai/codex", target: issueId, relation: "has-field-signal" });
  }

  if (githubRepo.ok && githubRepo.main_commit?.sha) {
    const commitId = `upstream-main:${githubRepo.main_commit.sha.slice(0, 12)}`;
    addNode(nodes, { id: commitId, type: "github-commit", label: githubRepo.main_commit.sha.slice(0, 12), url: githubRepo.main_commit.url });
    addEdge(edges, { source: "repo:openai/codex", target: commitId, relation: "main-at" });
  }

  return {
    nodes: [...nodes.values()],
    edges,
    metrics: {
      nodes: nodes.size,
      edges: edges.length,
      focused_processes: focused.length,
      focused_connections: connections.filter((item) => focusedPids.has(item.pid)).length,
      deep_sampled_processes: deepSamples.length,
    },
  };
}

function shortHash(value) {
  let hash = 5381;
  for (const char of String(value || "")) hash = (hash * 33) ^ char.charCodeAt(0);
  return (hash >>> 0).toString(16);
}

function summarizeSnapshot(snapshot) {
  const graph = snapshot.graph || { metrics: {} };
  return {
    status: snapshot.status,
    generated_at: snapshot.generated_at,
    codex_cli: snapshot.caches?.codex_system?.data?.versions?.codex_cli?.version || "unknown",
    desktop_versions: snapshot.caches?.codex_system?.data?.versions?.desktop_app?.versions_from_windowsapps || [],
    focused_processes: snapshot.processes?.focused?.length || 0,
    network_connections: snapshot.processes?.connections?.length || 0,
    deep_sampled_processes: snapshot.deep_samples?.length || 0,
    graph_nodes: graph.metrics.nodes || 0,
    graph_edges: graph.metrics.edges || 0,
    upstream_sha: snapshot.github_repo?.main_commit?.sha?.slice(0, 12) || "unknown",
    provider_status: snapshot.caches?.provider_scout?.data?.summary?.status || "unknown",
  };
}

async function buildSnapshot(args) {
  const progress = createProgressReporter({ operation: "codex-windows-map" });
  progress.heartbeat("start", "building Codex Windows graph snapshot");
  const [caches, processData, githubRepo] = await Promise.all([
    collectCaches(args, progress),
    collectProcesses(),
    collectGithubRepoContext(),
  ]);
  progress.heartbeat("deep-samples", "sampling focused DLLs and handles", { focused_processes: processData.focused.length });
  const focused = processData.focused.slice(0, args.maxProcesses);
  const deepSamples = await collectProcessDeepSamples(focused, args, progress);
  const graph = buildGraph({
    processes: processData,
    connections: processData.connections,
    deepSamples,
    caches,
    githubRepo,
  });
  const snapshot = {
    schema: "theseus.codex_windows_map.v1",
    generated_at: new Date().toISOString(),
    status: processData.commands.tasklist.ok && processData.commands.netstat.ok ? "OK" : "WARN",
    mode: "bounded-read-only-snapshot",
    privacy_note: "No raw transcripts, env vars, secrets, full packet traces, ProcMon traces, or dumps are captured.",
    limits: {
      max_processes: args.maxProcesses,
      max_dlls_per_process: args.maxDllsPerProcess,
      max_handles_per_process: args.maxHandlesPerProcess,
      refresh_caches: args.refreshCaches,
    },
    caches,
    github_repo: githubRepo,
    processes: {
      commands: processData.commands,
      total: processData.processes.length,
      focused: focused.map((process) => ({
        image: process.image,
        pid: process.pid,
        status: process.status,
        memory: process.memory,
        window_title: process.window_title,
      })),
      connections: processData.connections.filter((item) => focused.some((process) => process.pid === item.pid)).slice(0, 180),
    },
    deep_samples: deepSamples,
    graph,
  };
  snapshot.summary = summarizeSnapshot(snapshot);
  progress.done("snapshot built", snapshot.summary);
  return snapshot;
}

function listSnapshots() {
  if (!existsSync(snapshotDir)) return [];
  return readdirSync(snapshotDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(snapshotDir, name);
      return { name, filePath, mtime: statSync(filePath).mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

function diffSets(beforeItems, afterItems, key) {
  const before = new Map(beforeItems.map((item) => [key(item), item]));
  const after = new Map(afterItems.map((item) => [key(item), item]));
  return {
    added: [...after.entries()].filter(([id]) => !before.has(id)).map(([, item]) => item),
    removed: [...before.entries()].filter(([id]) => !after.has(id)).map(([, item]) => item),
    unchanged: [...after.entries()].filter(([id]) => before.has(id)).map(([, item]) => item),
  };
}

function compareSnapshots(before, after) {
  const processDiff = diffSets(before.processes?.focused || [], after.processes?.focused || [], (item) => `${item.image}:${item.pid}`);
  const portDiff = diffSets(before.processes?.connections || [], after.processes?.connections || [], (item) => `${item.pid}:${item.local}:${item.state}`);
  const nodeDiff = diffSets(before.graph?.nodes || [], after.graph?.nodes || [], (item) => item.id);
  const edgeDiff = diffSets(before.graph?.edges || [], after.graph?.edges || [], (item) => `${item.source}->${item.relation}->${item.target}`);
  return {
    schema: "theseus.codex_windows_map.compare.v1",
    generated_at: new Date().toISOString(),
    before: summarizeSnapshot(before),
    after: summarizeSnapshot(after),
    changes: {
      processes: {
        added: processDiff.added,
        removed: processDiff.removed,
        unchanged_count: processDiff.unchanged.length,
      },
      connections: {
        added_count: portDiff.added.length,
        removed_count: portDiff.removed.length,
        added_samples: portDiff.added.slice(0, 20),
        removed_samples: portDiff.removed.slice(0, 20),
      },
      graph: {
        added_nodes: nodeDiff.added.slice(0, 40),
        removed_nodes: nodeDiff.removed.slice(0, 40),
        added_edges_count: edgeDiff.added.length,
        removed_edges_count: edgeDiff.removed.length,
      },
    },
  };
}

function writeSnapshot(snapshot) {
  mkdirSync(snapshotDir, { recursive: true });
  const name = `codex-windows-map-${stamp(new Date(snapshot.generated_at))}`;
  const jsonPath = path.join(snapshotDir, `${name}.json`);
  const mdPath = path.join(snapshotDir, `${name}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderSnapshotMarkdown(snapshot), "utf8");
  writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, "latest.md"), renderSnapshotMarkdown(snapshot), "utf8");
  return { jsonPath, mdPath };
}

function writeCompare(compare) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(compareFile, `${JSON.stringify(compare, null, 2)}\n`, "utf8");
  writeFileSync(compareMarkdownFile, renderCompareMarkdown(compare), "utf8");
}

function renderSnapshotMarkdown(snapshot) {
  const s = snapshot.summary || summarizeSnapshot(snapshot);
  const lines = [
    "# Codex Windows Graph Snapshot",
    "",
    `Generated: ${snapshot.generated_at}`,
    `Status: ${snapshot.status}`,
    `Mode: ${snapshot.mode}`,
    "",
    "## Summary",
    "",
    `- Codex CLI: ${s.codex_cli}`,
    `- Desktop versions: ${s.desktop_versions.join(", ") || "unknown"}`,
    `- Focused processes: ${s.focused_processes}`,
    `- Deep sampled processes: ${s.deep_sampled_processes}`,
    `- Focused network rows: ${snapshot.processes?.connections?.length || 0}`,
    `- Graph: ${s.graph_nodes} nodes / ${s.graph_edges} edges`,
    `- openai/codex main: ${s.upstream_sha}`,
    `- Provider status: ${s.provider_status}`,
    "",
    "## Focused Processes",
    "",
    "| Image | PID | Status | Memory | Window |",
    "|---|---:|---|---:|---|",
  ];
  for (const process of snapshot.processes.focused.slice(0, 30)) {
    lines.push(`| ${process.image} | ${process.pid} | ${process.status || ""} | ${process.memory || ""} | ${String(process.window_title || "").replaceAll("|", "\\|").slice(0, 80)} |`);
  }
  lines.push("", "## Deep Samples", "");
  for (const sample of snapshot.deep_samples) {
    lines.push(`- ${sample.image} #${sample.pid}: ${sample.dlls.names.length} DLL names, ${sample.dlls.paths.length} DLL paths, ${sample.handles.samples.length} focused handles`);
  }
  lines.push("", "## Graph Metrics", "");
  for (const [key, value] of Object.entries(snapshot.graph.metrics)) lines.push(`- ${key}: ${value}`);
  lines.push("", "## Upstream Context", "");
  lines.push(`- Repo: ${snapshot.github_repo.repo?.html_url || "unknown"}`);
  lines.push(`- Pushed at: ${snapshot.github_repo.repo?.pushed_at || "unknown"}`);
  lines.push(`- Open issues: ${snapshot.github_repo.repo?.open_issues_count ?? "unknown"}`);
  lines.push(`- Main commit: ${snapshot.github_repo.main_commit?.sha || "unknown"}`);
  lines.push("");
  return lines.join("\n");
}

function renderCompareMarkdown(compare) {
  const lines = [
    "# Codex Windows Graph Snapshot Compare",
    "",
    `Generated: ${compare.generated_at}`,
    "",
    "## Before / After",
    "",
    `- Before: ${compare.before.generated_at}, ${compare.before.graph_nodes} nodes / ${compare.before.graph_edges} edges`,
    `- After: ${compare.after.generated_at}, ${compare.after.graph_nodes} nodes / ${compare.after.graph_edges} edges`,
    `- Codex CLI: ${compare.before.codex_cli} -> ${compare.after.codex_cli}`,
    `- openai/codex main: ${compare.before.upstream_sha} -> ${compare.after.upstream_sha}`,
    "",
    "## Changes",
    "",
    `- Processes added: ${compare.changes.processes.added.length}`,
    `- Processes removed: ${compare.changes.processes.removed.length}`,
    `- Connection rows added: ${compare.changes.connections.added_count}`,
    `- Connection rows removed: ${compare.changes.connections.removed_count}`,
    `- Graph nodes added: ${compare.changes.graph.added_nodes.length}`,
    `- Graph nodes removed: ${compare.changes.graph.removed_nodes.length}`,
    `- Graph edges added: ${compare.changes.graph.added_edges_count}`,
    `- Graph edges removed: ${compare.changes.graph.removed_edges_count}`,
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "snapshot") {
    const snapshot = await buildSnapshot(args);
    if (args.write) writeSnapshot(snapshot);
    if (args.format === "json") console.log(JSON.stringify(snapshot, null, 2));
    else console.log(renderSnapshotMarkdown(snapshot));
    process.exitCode = 0;
    return;
  }

  const snapshots = listSnapshots();
  if (snapshots.length < 2) {
    const payload = {
      schema: "theseus.codex_windows_map.compare.v1",
      generated_at: new Date().toISOString(),
      ok: false,
      error: "Need at least two saved snapshots to compare.",
      snapshot_count: snapshots.length,
    };
    if (args.format === "json") console.log(JSON.stringify(payload, null, 2));
    else console.log(`# Codex Windows Graph Snapshot Compare\n\n${payload.error}\n`);
    process.exitCode = 1;
    return;
  }

  const after = readJson(snapshots[0].filePath);
  const before = readJson(snapshots[1].filePath);
  const compare = compareSnapshots(before, after);
  if (args.write) writeCompare(compare);
  if (args.format === "json") console.log(JSON.stringify(compare, null, 2));
  else console.log(renderCompareMarkdown(compare));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
