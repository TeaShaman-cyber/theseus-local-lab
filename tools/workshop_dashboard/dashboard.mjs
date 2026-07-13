#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { env, exit } from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const host = env.THESEUS_HOST || "127.0.0.1";
const dockerEnv = {
  ...env,
  DOCKER_HOST: env.DOCKER_HOST || `tcp://${host}:2375`,
};
const dockerConfig = path.join(repoRoot, "tools", "docker_control_plane", "docker-cli-config");
if (existsSync(dockerConfig)) dockerEnv.DOCKER_CONFIG = dockerConfig;

function parseArgs(argv) {
  const args = { format: "markdown" };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--json") args.format = "json";
    if (item === "--markdown") args.format = "markdown";
  }
  return args;
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs || 12_000);
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

function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch {
          // Keep raw text.
        }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, body: parsed });
      });
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (error) => resolve({ ok: false, error: error.message }));
  });
}

function localUrl(port, pathName = "") {
  return `http://${host}:${port}${pathName}`;
}

function tcpCheck(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok, error = "") => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ok, host, port, error });
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false, "timeout"));
    socket.on("error", (error) => done(false, error.message));
  });
}

function relativeAge(date, now = new Date()) {
  if (!date) return null;
  return Math.max(0, now.getTime() - date.getTime());
}

function hours(ms) {
  if (ms === null || ms === undefined) return null;
  return ms / 3_600_000;
}

function formatAge(ms) {
  if (ms === null || ms === undefined) return "unknown";
  const h = hours(ms);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function latestFile(dir, predicate = () => true) {
  const full = path.resolve(repoRoot, dir);
  if (!existsSync(full)) return null;
  const files = readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => {
      const filePath = path.join(full, entry.name);
      const stat = statSync(filePath);
      return { name: entry.name, path: filePath, length: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return files[0] || null;
}

function readJsonl(dir) {
  const full = path.resolve(repoRoot, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) => {
      const filePath = path.join(full, name);
      return readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { parse_error: true, raw: line.slice(0, 160) };
          }
        });
    });
}

function item(id, label, status, detail, meta = {}) {
  return { id, label, status, detail, meta };
}

function statusFromFreshness(ageMs, okHours, warnHours) {
  const age = hours(ageMs);
  if (age === null) return "WARN";
  if (age <= okHours) return "OK";
  if (age <= warnHours) return "WARN";
  return "FAIL";
}

async function dockerContainers() {
  const result = await run("docker", ["ps", "--format", "{{json .}}"], { env: dockerEnv, timeoutMs: 8000 });
  if (!result.ok) return { ok: false, containers: [], error: result.stderr || result.stdout };
  const containers = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  return { ok: true, containers };
}

function findContainer(containers, names) {
  return containers.find((container) => {
    const value = `${container.Names || ""} ${container.Image || ""}`.toLowerCase();
    return names.some((name) => value.includes(name.toLowerCase()));
  });
}

async function gitState() {
  const branch = await run("git", ["status", "-sb"], { timeoutMs: 8000 });
  const short = await run("git", ["status", "--short"], { timeoutMs: 8000 });
  const first = branch.stdout.split(/\r?\n/).find(Boolean) || "";
  const dirty = short.stdout.split(/\r?\n/).filter(Boolean).length;
  const syncIssue = /\[.*(ahead|behind|diverged)/i.test(first);
  return { ok: branch.ok && short.ok, branch: first, dirty, syncIssue };
}

async function buildDashboard() {
  const now = new Date();
  const rows = [];

  const [automem, graphViewer, keychain, dockerTcp, logLattice, dockerControl, docker, git] = await Promise.all([
    httpGet(localUrl(8001, "/health")),
    tcpCheck(host, 5174),
    tcpCheck(host, 8088),
    tcpCheck(host, 2375),
    httpGet(localUrl(8768, "/health")),
    httpGet(localUrl(8767, "/health")),
    dockerContainers(),
    gitState(),
  ]);

  rows.push(item("automem-api", "AutoMem API", automem.ok ? "OK" : "FAIL", automem.ok ? "health endpoint responds" : automem.error || `HTTP ${automem.status}`));
  rows.push(item("graph-viewer", "AutoMem graph viewer", graphViewer.ok ? "OK" : "WARN", graphViewer.ok ? "port 5174 open" : graphViewer.error));
  rows.push(item("keychain", "Infisical keychain", keychain.ok ? "OK" : "WARN", keychain.ok ? "port 8088 open" : keychain.error));
  rows.push(item("docker-tcp", "Docker TCP", dockerTcp.ok ? "OK" : "FAIL", dockerTcp.ok ? "port 2375 open" : dockerTcp.error));
  rows.push(item("log-lattice", "Log lattice", logLattice.ok ? "OK" : "WARN", logLattice.ok ? "health endpoint responds" : logLattice.error || `HTTP ${logLattice.status}`));
  rows.push(item("docker-control", "Docker control fallback", dockerControl.ok ? "OK" : "WARN", dockerControl.ok ? "health endpoint responds" : dockerControl.error || `HTTP ${dockerControl.status}`));

  if (docker.ok) {
    const automemApi = findContainer(docker.containers, ["automem-flask-api"]);
    const qdrant = findContainer(docker.containers, ["automem-qdrant", "qdrant"]);
    const falkor = findContainer(docker.containers, ["automem-falkordb", "falkordb"]);
    const backup = findContainer(docker.containers, ["backup-runner"]);
    rows.push(item("automem-containers", "AutoMem containers", automemApi && qdrant && falkor ? "OK" : "WARN", [automemApi?.Names, qdrant?.Names, falkor?.Names].filter(Boolean).join(", ") || "not all core containers visible"));
    rows.push(item("backup-runner", "Backup runner container", backup ? "OK" : "WARN", backup ? `${backup.Names} ${backup.Status || ""}`.trim() : "backup runner not visible in docker ps"));
  } else {
    rows.push(item("docker-ps", "Docker containers", "WARN", docker.error || "docker ps unavailable"));
  }

  const latestBackup = latestFile("backups/data", (name) => name.endsWith(".tar.gz"));
  const backupAge = latestBackup ? relativeAge(latestBackup.mtime, now) : null;
  rows.push(
    item(
      "latest-backup",
      "Latest local backup",
      latestBackup ? statusFromFreshness(backupAge, 8, 24) : "FAIL",
      latestBackup ? `${latestBackup.name}, ${formatAge(backupAge)} old, ${latestBackup.length} bytes` : "no local backup archive",
    ),
  );

  const mirrorCandidates = [
    env.THESEUS_CLOUD_MIRROR_DIR,
    path.resolve(repoRoot, "..", "..", "theseus-cloud-backups"),
    path.resolve(repoRoot, "..", "theseus-cloud-backups"),
    "/cloud-backups",
  ].filter(Boolean);
  const mirrorDir = mirrorCandidates.find((candidate) => existsSync(candidate));
  const latestMirror = mirrorDir
    ? latestFile(path.isAbsolute(mirrorDir) ? mirrorDir : path.relative(repoRoot, mirrorDir), (name) => name.endsWith(".tar.gz"))
    : null;
  const mirrorAge = latestMirror ? relativeAge(latestMirror.mtime, now) : null;
  rows.push(
    item(
      "cloud-mirror",
      "Cloud mirror folder",
      latestMirror ? statusFromFreshness(mirrorAge, 8, 24) : "WARN",
      latestMirror ? `${latestMirror.name}, ${formatAge(mirrorAge)} old` : "mirror folder/archive not found",
    ),
  );

  const latestPacket = latestFile("outputs/state_packets", (name) => name.endsWith(".md"));
  const packetAge = latestPacket ? relativeAge(latestPacket.mtime, now) : null;
  rows.push(
    item(
      "state-packet",
      "Compact state packets",
      latestPacket ? statusFromFreshness(packetAge, 24, 72) : "WARN",
      latestPacket ? `${latestPacket.name}, ${formatAge(packetAge)} old` : "no state packet found",
    ),
  );

  const researchItems = readJsonl("outputs/research_queue");
  const pendingResearch = researchItems.filter((entry) => entry.status === "pending").length;
  const latestResearch = researchItems
    .filter((entry) => entry.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  rows.push(
    item(
      "research-queue",
      "Research queue",
      pendingResearch > 30 ? "WARN" : "OK",
      `${pendingResearch} pending${latestResearch ? `, latest ${latestResearch.created_at}` : ""}`,
    ),
  );

  const latestTimeline = latestFile("outputs/session_timeline", (name) => name.endsWith(".jsonl"));
  const timelineAge = latestTimeline ? relativeAge(latestTimeline.mtime, now) : null;
  rows.push(
    item(
      "session-timeline",
      "Session timeline",
      latestTimeline ? statusFromFreshness(timelineAge, 24, 72) : "WARN",
      latestTimeline ? `${latestTimeline.name}, ${formatAge(timelineAge)} old` : "no timeline file found",
    ),
  );

  const observatoryState = ["state.db", "state.db-shm", "state.db-wal"]
    .map((name) => {
      const filePath = path.join(repoRoot, "stateful-agent-net", "data", name);
      if (!existsSync(filePath)) return null;
      const stat = statSync(filePath);
      return { name, mtime: stat.mtime, length: stat.size };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
  const observatoryAge = observatoryState ? relativeAge(observatoryState.mtime, now) : null;
  rows.push(
    item(
      "observatory-db",
      "Local observatory DB",
      observatoryState ? statusFromFreshness(observatoryAge, 24, 96) : "WARN",
      observatoryState ? `${observatoryState.name}, ${formatAge(observatoryAge)} old` : "stateful-agent-net/data/state.db not found",
    ),
  );

  rows.push(
    item(
      "git-sync",
      "Git sync",
      git.ok && git.dirty === 0 && !git.syncIssue ? "OK" : "WARN",
      git.ok ? `${git.branch || "unknown branch"}, dirty files: ${git.dirty}` : "git status failed",
    ),
  );

  const statusRank = { OK: 0, WARN: 1, FAIL: 2 };
  const worst = rows.reduce((acc, row) => (statusRank[row.status] > statusRank[acc] ? row.status : acc), "OK");
  return {
    generated_at: now.toISOString(),
    overall: worst,
    rows,
  };
}

function renderMarkdown(dashboard) {
  const lines = [
    "# Theseus Workshop Dashboard",
    "",
    `Generated: ${dashboard.generated_at}`,
    `Overall: ${dashboard.overall}`,
    "",
    "| Status | Area | Detail |",
    "|---|---|---|",
  ];
  for (const row of dashboard.rows) {
    lines.push(`| ${row.status} | ${row.label} | ${String(row.detail || "").replaceAll("|", "\\|")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
buildDashboard()
  .then((dashboard) => {
    if (args.format === "json") {
      console.log(JSON.stringify(dashboard, null, 2));
    } else {
      console.log(renderMarkdown(dashboard));
    }
    if (dashboard.overall === "FAIL") process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error.message);
    exit(1);
  });
