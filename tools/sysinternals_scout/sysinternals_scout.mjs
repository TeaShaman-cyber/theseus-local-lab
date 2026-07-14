#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const defaultOutputDir = path.join(repoRoot, "outputs", "sysinternals_scout");

const sysinternalsTools = ["procexp", "procmon", "procdump", "handle", "tcpview", "tcpvcon"];
const interestingTerms = [
  "codex",
  "chatgpt",
  "openai",
  "node",
  "docker",
  "wsl",
  "v2ray",
  "infisical",
  "qdrant",
  "falkor",
  "redis",
  "postgres",
  "chrome",
  "opera",
  "code",
];
const interestingPorts = new Set([
  "2375",
  "3000",
  "5174",
  "5180",
  "6333",
  "6334",
  "6379",
  "8001",
  "8088",
  "8767",
  "8768",
  "10808",
  "10809",
  "7897",
  "9097",
]);

function parseArgs(argv) {
  const args = {
    format: "markdown",
    write: false,
    outputDir: defaultOutputDir,
    maxProcesses: 80,
    maxConnections: 80,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--json") args.format = "json";
    else if (item === "--markdown") args.format = "markdown";
    else if (item === "--write") args.write = true;
    else if (item === "--output-dir") args.outputDir = path.resolve(argv[++i] || defaultOutputDir);
    else if (item === "--max-processes") args.maxProcesses = Number(argv[++i] || args.maxProcesses);
    else if (item === "--max-connections") args.maxConnections = Number(argv[++i] || args.maxConnections);
  }
  return args;
}

function run(command, args, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}${stderr ? "\n" : ""}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
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

function parseLocalPort(endpoint) {
  const value = String(endpoint || "");
  const match = value.match(/:(\d+)$/);
  return match ? match[1] : "";
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
          foreign: parts[2],
          state: parts[3],
          pid: parts[4],
          local_port: parseLocalPort(parts[1]),
        };
      }
      if (parts[0]?.toUpperCase() === "UDP" && parts.length >= 4) {
        return {
          proto: "UDP",
          local: parts[1],
          foreign: parts[2],
          state: "UDP",
          pid: parts[3],
          local_port: parseLocalPort(parts[1]),
        };
      }
      return null;
    })
    .filter(Boolean);
}

function includesInterestingText(process) {
  const haystack = `${process.image} ${process.user} ${process.window_title}`.toLowerCase();
  return interestingTerms.some((term) => haystack.includes(term));
}

function processSort(a, b) {
  const aName = `${a.image}`.toLowerCase();
  const bName = `${b.image}`.toLowerCase();
  return aName.localeCompare(bName) || Number(a.pid || 0) - Number(b.pid || 0);
}

function summarizeNetwork(connections, processByPid, maxConnections) {
  const byProcess = new Map();
  const listeners = [];
  const interesting = [];

  for (const connection of connections) {
    const process = processByPid.get(connection.pid);
    const processName = process?.image || "unknown";
    const bucket = byProcess.get(connection.pid) || {
      pid: connection.pid,
      image: processName,
      total: 0,
      listeners: 0,
      established: 0,
      local_ports: new Set(),
    };
    bucket.total += 1;
    if (connection.state === "LISTENING") bucket.listeners += 1;
    if (connection.state === "ESTABLISHED") bucket.established += 1;
    if (connection.local_port) bucket.local_ports.add(connection.local_port);
    byProcess.set(connection.pid, bucket);

    const isInteresting =
      interestingPorts.has(connection.local_port) ||
      (process && includesInterestingText(process)) ||
      connection.state === "LISTENING";
    if (isInteresting) interesting.push({ ...connection, image: processName });
    if (connection.state === "LISTENING") listeners.push({ ...connection, image: processName });
  }

  return {
    total_connections: connections.length,
    interesting_connections: interesting.length,
    listeners: listeners
      .sort((a, b) => Number(a.local_port || 0) - Number(b.local_port || 0) || a.image.localeCompare(b.image))
      .slice(0, maxConnections),
    interesting_samples: interesting
      .sort((a, b) => a.image.localeCompare(b.image) || Number(a.local_port || 0) - Number(b.local_port || 0))
      .slice(0, maxConnections)
      .map((item) => ({
        proto: item.proto,
        local: item.local,
        state: item.state,
        pid: item.pid,
        image: item.image,
      })),
    by_process: [...byProcess.values()]
      .map((item) => ({ ...item, local_ports: [...item.local_ports].sort((a, b) => Number(a) - Number(b)) }))
      .sort((a, b) => b.total - a.total || a.image.localeCompare(b.image))
      .slice(0, 30),
  };
}

async function collectTools() {
  const items = [];
  for (const name of sysinternalsTools) {
    const result = await run("where.exe", [name], 4_000);
    const paths = result.ok ? result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
    items.push({
      name,
      available: paths.length > 0,
      paths,
      note: paths.length > 0 ? "available on PATH" : "not found on PATH",
    });
  }
  return {
    available_count: items.filter((item) => item.available).length,
    missing: items.filter((item) => !item.available).map((item) => item.name),
    items,
  };
}

async function collect(args) {
  const [tools, tasklist, netstat] = await Promise.all([
    collectTools(),
    run("tasklist.exe", ["/fo", "csv", "/nh"], 8_000),
    run("netstat.exe", ["-ano"], 12_000),
  ]);

  const processes = tasklist.ok ? parseTasklist(tasklist.stdout) : [];
  const processByPid = new Map(processes.map((process) => [process.pid, process]));
  const connections = netstat.ok ? parseNetstat(netstat.stdout) : [];
  const interestingPids = new Set();

  for (const process of processes) {
    if (includesInterestingText(process)) interestingPids.add(process.pid);
  }
  for (const connection of connections) {
    if (interestingPorts.has(connection.local_port)) interestingPids.add(connection.pid);
    const process = processByPid.get(connection.pid);
    if (process && includesInterestingText(process)) interestingPids.add(connection.pid);
  }

  const interestingProcesses = processes
    .filter((process) => interestingPids.has(process.pid))
    .sort(processSort);

  const network = summarizeNetwork(connections, processByPid, args.maxConnections);
  return {
    ok: tasklist.ok && netstat.ok,
    generated_at: new Date().toISOString(),
    mode: "lightweight-read-only",
    privacy_note: "External endpoints are summarized through counts and bounded samples; no dumps or traces are captured.",
    sysinternals_tools: tools,
    commands: {
      tasklist: { ok: tasklist.ok, code: tasklist.code, stderr: tasklist.stderr.trim().slice(0, 500) },
      netstat: { ok: netstat.ok, code: netstat.code, stderr: netstat.stderr.trim().slice(0, 500) },
    },
    processes: {
      total: processes.length,
      interesting_count: interestingProcesses.length,
      displayed_count: Math.min(interestingProcesses.length, args.maxProcesses),
      items: interestingProcesses.slice(0, args.maxProcesses),
    },
    network,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Sysinternals Scout",
    "",
    `Generated: ${report.generated_at}`,
    `Mode: ${report.mode}`,
    `Status: ${report.ok ? "OK" : "WARN"}`,
    "",
    "## Tool Availability",
    "",
    "| Tool | Status | Note |",
    "|---|---|---|",
  ];
  for (const tool of report.sysinternals_tools.items) {
    lines.push(`| ${tool.name} | ${tool.available ? "available" : "missing"} | ${tool.note} |`);
  }

  lines.push(
    "",
    "## Process Summary",
    "",
    `Total processes: ${report.processes.total}`,
    `Interesting processes: ${report.processes.interesting_count}`,
    "",
    "| Image | PID | Status | Memory | Window |",
    "|---|---:|---|---:|---|",
  );
  for (const process of report.processes.items.slice(0, 30)) {
    lines.push(
      `| ${process.image} | ${process.pid} | ${process.status} | ${process.memory} | ${String(process.window_title || "").replaceAll("|", "\\|").slice(0, 80)} |`,
    );
  }

  lines.push(
    "",
    "## Network Summary",
    "",
    `Total connections: ${report.network.total_connections}`,
    `Interesting connections: ${report.network.interesting_connections}`,
    "",
    "| Image | PID | Total | Listening | Established | Local ports |",
    "|---|---:|---:|---:|---:|---|",
  );
  for (const item of report.network.by_process.slice(0, 20)) {
    lines.push(
      `| ${item.image} | ${item.pid} | ${item.total} | ${item.listeners} | ${item.established} | ${item.local_ports.slice(0, 12).join(", ")} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function writeOutputs(report, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "sysinternals-scout.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, "sysinternals-scout.md"), renderMarkdown(report), "utf8");
}

const args = parseArgs(process.argv.slice(2));
const report = await collect(args);
if (args.write) writeOutputs(report, args.outputDir);
if (args.format === "json") console.log(JSON.stringify(report, null, 2));
else console.log(renderMarkdown(report));
process.exitCode = report.ok ? 0 : 1;
