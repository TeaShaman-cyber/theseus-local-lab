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
  const args = { format: "markdown", rows: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--json") args.format = "json";
    if (item === "--markdown") args.format = "markdown";
    if (item === "--rows") {
      args.rows = String(argv[++i] || "")
        .split(",")
        .map((row) => row.trim())
        .filter(Boolean);
    }
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

function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
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

function recentToolPolicyIncidents(now = new Date(), windowHours = 24) {
  const cutoff = now.getTime() - windowHours * 3_600_000;
  return readJsonl("outputs/tool_policy")
    .filter((entry) => {
      const ts = Date.parse(entry.ts || entry.created_at || "");
      if (!Number.isFinite(ts) || ts < cutoff) return false;
      const verdict = entry.decision?.verdict;
      return verdict === "block" || verdict === "warn";
    })
    .map((entry) => ({
      ts: entry.ts,
      verdict: entry.decision?.verdict || "unknown",
      reason: entry.decision?.reason || "unknown",
      reinforcement: entry.decision?.reinforcement?.score ?? 0,
    }));
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
  const gitArgs = ["-c", "core.autocrlf=input"];
  const branch = await run("git", [...gitArgs, "status", "-sb"], { timeoutMs: 8000 });
  const short = await run("git", [...gitArgs, "status", "--short"], { timeoutMs: 8000 });
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
  rows.push(
    item(
      "docker-control",
      "Docker control fallback",
      dockerControl.ok || dockerTcp.ok ? "OK" : "WARN",
      dockerControl.ok
        ? "health endpoint responds"
        : dockerTcp.ok
          ? "fallback daemon not running; preferred Docker TCP works"
          : dockerControl.error || `HTTP ${dockerControl.status}`,
    ),
  );

  const incidents = recentToolPolicyIncidents(now);
  const incidentCounts = new Map();
  for (const incident of incidents) {
    incidentCounts.set(incident.reason, (incidentCounts.get(incident.reason) || 0) + 1);
  }
  const incidentSummary = [...incidentCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ");
  rows.push(
    item(
      "route-incidents",
      "Blameless route incidents",
      incidents.length > 0 ? "WARN" : "OK",
      incidents.length > 0 ? `${incidents.length} in last 24h (${incidentSummary})` : "no blocked or warned routes in last 24h",
    ),
  );

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
  const pendingResearch = researchItems.filter((entry) => entry.status === "pending");
  const genericHookResearch = pendingResearch.filter((entry) => entry.topic === "Review hook event for possible connector-backed research").length;
  const actionableResearch = pendingResearch.length - genericHookResearch;
  const latestResearch = researchItems
    .filter((entry) => entry.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  rows.push(
    item(
      "research-queue",
      "Research queue",
      actionableResearch > 10 ? "WARN" : "OK",
      `${actionableResearch} actionable pending, ${genericHookResearch} legacy hook-review${latestResearch ? `, latest ${latestResearch.created_at}` : ""}`,
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

  const modelRuntimeFile = path.join(repoRoot, "outputs", "model_switch_guard", "state.json");
  const modelRuntime = readJsonFile(modelRuntimeFile);
  const modelRuntimeObservedAt = modelRuntime?.observed_at ? new Date(modelRuntime.observed_at) : null;
  const modelRuntimeAge = modelRuntimeObservedAt ? relativeAge(modelRuntimeObservedAt, now) : null;

  const usageScoutFile = path.join(repoRoot, "outputs", "usage_scout", "latest.json");
  const usageScout = readJsonFile(usageScoutFile);
  const usageObservedAt = usageScout?.observed_at ? new Date(usageScout.observed_at) : null;
  const usageAge = usageObservedAt ? relativeAge(usageObservedAt, now) : null;
  const runtimeConflict =
    modelRuntime &&
    usageScout?.codex &&
    (
      (usageScout.codex.model && modelRuntime.model && usageScout.codex.model !== modelRuntime.model) ||
      (
        usageScout.codex.reasoning_effort &&
        modelRuntime.reasoning_effort &&
        usageScout.codex.reasoning_effort !== modelRuntime.reasoning_effort
      )
    );
  rows.push(
    item(
      "model-runtime",
      "Model runtime",
      modelRuntime ? (runtimeConflict ? "WARN" : statusFromFreshness(modelRuntimeAge, 12, 48)) : "WARN",
      modelRuntime
        ? [
            `${modelRuntime.model || "unknown"} / ${modelRuntime.reasoning_effort || "unknown"}`,
            `${formatAge(modelRuntimeAge)} since preflight`,
            runtimeConflict
              ? `conflicts with usage scout: ${usageScout.codex?.model || "unknown"} / ${usageScout.codex?.reasoning_effort || "unknown"}`
              : "",
          ].filter(Boolean).join("; ")
        : "model-switch guard has not observed this runtime yet",
    ),
  );
  const bindingLimit = usageScout?.limits?.find(
    (limit) => limit.key === usageScout?.derived?.binding_limit_key,
  );
  const usagePercent = bindingLimit?.used_percent;
  const usageStatus =
    usagePercent >= 100 ? "FAIL" : usagePercent >= 90 ? "WARN" : statusFromFreshness(usageAge, 2, 8);
  const usageDetail = usageScout
    ? [
        `${usageScout.codex?.model || "unknown"} / ${usageScout.codex?.reasoning_effort || "unknown"}`,
        bindingLimit
          ? `${bindingLimit.window_minutes || "?"}m: ${bindingLimit.used_percent ?? "?"}% used, ${bindingLimit.remaining_percent_derived ?? "?"}% left`
          : "binding limit unknown",
        `${formatAge(usageAge)} old`,
        usageScout.source || "unknown source",
      ].join("; ")
    : "run node tools/usage_scout/usage_scout.mjs";
  rows.push(
    item(
      "usage-scout",
      "Codex usage scout",
      usageScout
        ? usageScout.quality?.warnings?.length
          ? "WARN"
          : usageStatus
        : "WARN",
      usageDetail,
    ),
  );

  const lensUsageTrialFile = path.join(repoRoot, "outputs", "lens_usage_trial", "latest.json");
  const lensUsageTrialStat = existsSync(lensUsageTrialFile) ? statSync(lensUsageTrialFile) : null;
  const lensUsageTrial = readJsonFile(lensUsageTrialFile);
  const lensUsageTrialAge = lensUsageTrialStat ? relativeAge(lensUsageTrialStat.mtime, now) : null;
  const lensUsageDelta = lensUsageTrial?.delta?.used_percent_delta;
  const lensUsageStatus = lensUsageTrial
    ? lensUsageTrial.marks?.start && !lensUsageTrial.marks?.end
      ? "WARN"
      : statusFromFreshness(lensUsageTrialAge, 24, 96)
    : "WARN";
  rows.push(
    item(
      "lens-usage-trial",
      "Lens usage trial",
      lensUsageStatus,
      lensUsageTrial
        ? `${lensUsageTrial.trial || "unknown"}; ${lensUsageTrial.route || "unknown"}; ${lensUsageDelta ?? "pending"} pp, ${lensUsageTrial.delta?.session_total_tokens_delta ?? "pending"} tokens; ${formatAge(lensUsageTrialAge)} old`
        : "run node tools/lens_usage_trial/lens_usage_trial.mjs start --trial <id>",
    ),
  );

  const graphifyLatest = readJsonFile(path.join(repoRoot, "outputs", "graphify_harness", "latest_harness.json"));
  const graphifyLatestStat = existsSync(path.join(repoRoot, "outputs", "graphify_harness", "latest_harness.json"))
    ? statSync(path.join(repoRoot, "outputs", "graphify_harness", "latest_harness.json"))
    : null;
  const graphifyQuery = readJsonFile(path.join(repoRoot, "outputs", "graphify_harness", "latest_query_harness.json"));
  const graphifyAge = graphifyLatestStat ? relativeAge(graphifyLatestStat.mtime, now) : null;
  const graphifyStatus = graphifyLatest
    ? graphifyQuery?.status === "failed"
      ? "WARN"
      : statusFromFreshness(graphifyAge, 48, 168)
    : "WARN";
  rows.push(
    item(
      "graphify-harness",
      "Graphify harness lens",
      graphifyStatus,
      graphifyLatest
        ? [
            `${graphifyLatest.stats?.nodes ?? "?"} nodes`,
            `${graphifyLatest.stats?.edges ?? "?"} edges`,
            `${formatAge(graphifyAge)} old`,
            graphifyQuery ? `last ${graphifyQuery.command || "query"}: ${graphifyQuery.status}` : "no query yet",
          ].join("; ")
        : "run Theseus Graphify Harness: build",
    ),
  );

  const chatCorpusLensFile = path.join(repoRoot, "outputs", "chat_corpus_lens", "latest.json");
  const chatCorpusLensStat = existsSync(chatCorpusLensFile) ? statSync(chatCorpusLensFile) : null;
  const chatCorpusLens = readJsonFile(chatCorpusLensFile);
  const chatCorpusLensAge = chatCorpusLensStat ? relativeAge(chatCorpusLensStat.mtime, now) : null;
  rows.push(
    item(
      "chat-corpus-lens",
      "Chat corpus lens",
      chatCorpusLens ? statusFromFreshness(chatCorpusLensAge, 48, 168) : "WARN",
      chatCorpusLens
        ? [
            chatCorpusLens.source?.chat_title || chatCorpusLens.source?.filename || "chat",
            `${chatCorpusLens.extraction?.messages ?? "?"} messages`,
            `${chatCorpusLens.compression?.source_to_lens_ratio ?? "?"}x`,
            `${formatAge(chatCorpusLensAge)} old`,
          ].join("; ")
        : "run Theseus Chat Corpus Lens: Strazh trial",
    ),
  );

  const ocrLensFile = path.join(repoRoot, "outputs", "ocr_lens", "latest.json");
  const ocrLensStat = existsSync(ocrLensFile) ? statSync(ocrLensFile) : null;
  const ocrLens = readJsonFile(ocrLensFile);
  const ocrLensAge = ocrLensStat ? relativeAge(ocrLensStat.mtime, now) : null;
  const ocrLensStatus =
    ocrLens?.extraction?.status === "text_ready"
      ? statusFromFreshness(ocrLensAge, 24, 96)
      : ocrLens
        ? "WARN"
        : "WARN";
  rows.push(
    item(
      "ocr-lens",
      "OCR lens",
      ocrLensStatus,
      ocrLens
        ? `${ocrLens.extraction?.status || "unknown"}; ${ocrLens.source?.filename || "unknown"}; ${ocrLens.extraction?.pages_read || 0}/${ocrLens.extraction?.page_count || 0} pages; ${formatAge(ocrLensAge)} old`
        : "run node tools/ocr_lens/ocr_lens.mjs <file.pdf> --write",
    ),
  );

  const sourceLensFile = path.join(repoRoot, "outputs", "source_lens", "latest.json");
  const sourceLensStat = existsSync(sourceLensFile) ? statSync(sourceLensFile) : null;
  const sourceLens = readJsonFile(sourceLensFile);
  const sourceLensAge = sourceLensStat ? relativeAge(sourceLensStat.mtime, now) : null;
  const sourceLensStatus =
    sourceLens?.extraction?.status === "lens_ready"
      ? statusFromFreshness(sourceLensAge, 24, 96)
      : sourceLens
        ? "WARN"
        : "WARN";
  const latestSourceLensDraft = latestFile("outputs/memory_inbox", (name) => name.endsWith(".source-lens.memory.json"));
  rows.push(
    item(
      "source-lens",
      "Source lens",
      sourceLensStatus,
      sourceLens
        ? `${sourceLens.extraction?.status || "unknown"}; ${sourceLens.source?.filename || "unknown"}; ${sourceLens.extraction?.source_count || 0} sources, ${sourceLens.extraction?.claim_count || 0} claims; ${latestSourceLensDraft ? "memory draft ready" : "no memory draft"}; ${formatAge(sourceLensAge)} old`
        : "run node tools/source_lens/source_lens.mjs <file.json|file.md> --write --memory-draft",
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

  const codexIssuesFile = path.join(repoRoot, "outputs", "github_issue_watch", "openai-codex.json");
  const codexIssuesStat = existsSync(codexIssuesFile) ? statSync(codexIssuesFile) : null;
  const codexIssues = readJsonFile(codexIssuesFile);
  const codexIssuesAge = codexIssuesStat ? relativeAge(codexIssuesStat.mtime, now) : null;
  rows.push(
    item(
      "codex-issues",
      "OpenAI Codex issues",
      codexIssues ? statusFromFreshness(codexIssuesAge, 12, 48) : "WARN",
      codexIssues
        ? `${codexIssues.high_signal_count || 0} high-signal, ${codexIssues.new_count || 0} new, ${codexIssues.updated_count || 0} updated; ${formatAge(codexIssuesAge)} old`
        : "run node tools/github_issue_watch/github_issue_watch.mjs --write",
      {
        url: codexIssues?.source_url || "https://github.com/openai/codex/issues",
      },
    ),
  );

  const codexSystemFile = path.join(repoRoot, "outputs", "codex_system_watch", "codex-system.json");
  const codexSystemStat = existsSync(codexSystemFile) ? statSync(codexSystemFile) : null;
  const codexSystem = readJsonFile(codexSystemFile);
  const codexSystemAge = codexSystemStat ? relativeAge(codexSystemStat.mtime, now) : null;
  const codexEventCount = codexSystem?.windows_events?.matched || 0;
  rows.push(
    item(
      "codex-system",
      "Codex local system watch",
      codexSystem ? (codexEventCount > 0 ? "WARN" : statusFromFreshness(codexSystemAge, 12, 48)) : "WARN",
      codexSystem
        ? `${codexSystem.versions?.codex_cli?.version || "unknown CLI"}, ${codexEventCount} matched Windows events; ${formatAge(codexSystemAge)} old`
        : "run node tools/codex_system_watch/codex_system_watch.mjs --write",
    ),
  );

  const sysinternalsFile = path.join(repoRoot, "outputs", "sysinternals_scout", "sysinternals-scout.json");
  const sysinternalsStat = existsSync(sysinternalsFile) ? statSync(sysinternalsFile) : null;
  const sysinternals = readJsonFile(sysinternalsFile);
  const sysinternalsAge = sysinternalsStat ? relativeAge(sysinternalsStat.mtime, now) : null;
  rows.push(
    item(
      "sysinternals-scout",
      "Sysinternals scout",
      sysinternals ? statusFromFreshness(sysinternalsAge, 12, 48) : "WARN",
      sysinternals
        ? `${sysinternals.processes?.interesting_count || 0} interesting processes, ${sysinternals.network?.interesting_connections || 0} interesting connections; ${formatAge(sysinternalsAge)} old`
        : "run node tools/sysinternals_scout/sysinternals_scout.mjs --write",
    ),
  );

  const codexWindowsMapFile = path.join(repoRoot, "outputs", "codex_windows_map", "latest.json");
  const codexWindowsMapStat = existsSync(codexWindowsMapFile) ? statSync(codexWindowsMapFile) : null;
  const codexWindowsMap = readJsonFile(codexWindowsMapFile);
  const codexWindowsMapAge = codexWindowsMapStat ? relativeAge(codexWindowsMapStat.mtime, now) : null;
  rows.push(
    item(
      "codex-windows-map",
      "Codex Windows graph map",
      codexWindowsMap ? statusFromFreshness(codexWindowsMapAge, 12, 48) : "WARN",
      codexWindowsMap
        ? `${codexWindowsMap.graph?.metrics?.nodes || 0} nodes, ${codexWindowsMap.graph?.metrics?.edges || 0} edges, ${codexWindowsMap.summary?.focused_processes || 0} focused processes; ${formatAge(codexWindowsMapAge)} old`
        : "run node tools/codex_windows_map/codex_windows_map.mjs snapshot --write",
    ),
  );

  const providerScoutFile = path.join(repoRoot, "outputs", "provider_scout", "provider-scout.json");
  const providerScoutStat = existsSync(providerScoutFile) ? statSync(providerScoutFile) : null;
  const providerScout = readJsonFile(providerScoutFile);
  const providerScoutAge = providerScoutStat ? relativeAge(providerScoutStat.mtime, now) : null;
  rows.push(
    item(
      "provider-scout",
      "Provider scout",
      providerScout ? (providerScout.summary?.status === "OK" ? statusFromFreshness(providerScoutAge, 2, 8) : "WARN") : "WARN",
      providerScout
        ? `${providerScout.summary?.local_match_count || 0} local provider matches, ${providerScout.summary?.github_capacity_issue_count || 0} GitHub issue matches; ${formatAge(providerScoutAge)} old`
        : "run node tools/provider_scout/provider_scout.mjs --write",
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

function filterDashboardRows(dashboard, rowIds = []) {
  if (!rowIds.length) return dashboard;
  const wanted = new Set(rowIds);
  return {
    ...dashboard,
    rows: dashboard.rows.filter((row) => wanted.has(row.id)),
    filtered_rows: rowIds,
  };
}

function renderMarkdown(dashboard) {
  const lines = [
    "# Theseus Workshop Dashboard",
    "",
    `Generated: ${dashboard.generated_at}`,
    `Overall: ${dashboard.overall}`,
    ...(dashboard.filtered_rows ? [`Rows: ${dashboard.filtered_rows.join(", ")}`] : []),
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
    const filtered = filterDashboardRows(dashboard, args.rows);
    if (args.format === "json") {
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      console.log(renderMarkdown(filtered));
    }
    if (dashboard.overall === "FAIL") process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error.message);
    exit(1);
  });
