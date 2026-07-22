#!/usr/bin/env node

import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { windowsPathToWsl } from "../runtime_paths/host_path.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
const databasePath = path.join(codexHome, "logs_2.sqlite");
const writeReport = process.argv.includes("--write");
const deepAudit = process.argv.includes("--deep");

if (!existsSync(databasePath)) {
  throw new Error(`Codex log database not found: ${databasePath}`);
}

const database = new DatabaseSync(databasePath, { readOnly: true });
const latestProcess = database.prepare(`
  SELECT process_uuid, ts AS latest_ts
  FROM logs
  WHERE process_uuid IS NOT NULL
  ORDER BY ts DESC, ts_nanos DESC
  LIMIT 1
`).get();

if (!latestProcess?.process_uuid) {
  throw new Error("Codex log database contains no process UUID");
}

const processUuid = latestProcess.process_uuid;
const latestThread = deepAudit
  ? database.prepare(`
      SELECT thread_id
      FROM logs
      WHERE process_uuid = ? AND thread_id IS NOT NULL
      ORDER BY ts DESC, ts_nanos DESC
      LIMIT 1
    `).get(processUuid)
  : null;
const recentRows = database.prepare(`
  SELECT level, target, feedback_log_body, ts
  FROM logs
  WHERE process_uuid = ?
  ORDER BY ts DESC, ts_nanos DESC
  LIMIT 500
`).all(processUuid);
const unavailableRows = recentRows.filter((row) => String(row.feedback_log_body || "").includes("MCP server tools unavailable while building tool list"));
const hookRows = recentRows.filter((row) =>
  ["WARN", "ERROR"].includes(row.level)
  && (String(row.target || "").includes("hook")
    || String(row.feedback_log_body || "").includes("hook failed")
    || String(row.feedback_log_body || "").includes("loading hooks from both")),
).slice(0, 20);
const pathRows = recentRows.filter((row) => /app[\\/]resources[\\/][A-Za-z]:\\/.test(String(row.feedback_log_body || ""))).slice(0, 20);

function latestTurnContext(threadId) {
  if (!threadId) return null;
  const statePath = path.join(codexHome, "state_5.sqlite");
  if (!existsSync(statePath)) return null;
  const state = new DatabaseSync(statePath, { readOnly: true });
  const row = state.prepare("SELECT rollout_path FROM threads WHERE id = ?").get(threadId);
  state.close();
  const storedPath = String(row?.rollout_path || "").replace(/^\\\\\?\\/, "");
  const rolloutPath = existsSync(storedPath) ? storedPath : windowsPathToWsl(storedPath);
  if (!rolloutPath || !existsSync(rolloutPath)) return null;
  const size = statSync(rolloutPath).size;
  const tailBytes = Math.min(size, 512 * 1024);
  const buffer = Buffer.allocUnsafe(tailBytes);
  const descriptor = openSync(rolloutPath, "r");
  try {
    readSync(descriptor, buffer, 0, tailBytes, size - tailBytes);
  } finally {
    closeSync(descriptor);
  }
  const tail = buffer.toString("utf8");
  const marker = '"type":"turn_context"';
  const markerIndex = tail.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const lineStart = tail.lastIndexOf("\n", markerIndex) + 1;
  const nextNewline = tail.indexOf("\n", markerIndex);
  const lineEnd = nextNewline < 0 ? tail.length : nextNewline;
  try {
    const event = JSON.parse(tail.slice(lineStart, lineEnd));
    return { rollout_path: rolloutPath, payload: event.payload || {} };
  } catch {
    // The tail may begin or end inside a very large event.
  }
  return null;
}

function uniqueServerNames(rows) {
  return [...new Set(rows.flatMap((row) => {
    const match = String(row.feedback_log_body || "").match(/server_name=([^\s]+)/);
    return match ? [match[1]] : [];
  }))].sort();
}

function sanitizeBody(value) {
  return String(value || "")
    .replaceAll(process.env.USERPROFILE || "__NO_USERPROFILE__", "<user-profile>")
    .replaceAll(codexHome, "<codex-home>")
    .slice(0, 500);
}

const unavailableServers = uniqueServerNames(unavailableRows);
const turnContext = deepAudit ? latestTurnContext(latestThread?.thread_id) : null;
const contextPaths = [turnContext?.payload?.cwd, ...(turnContext?.payload?.workspace_roots || [])].filter(Boolean);
const malformedContextPaths = contextPaths.filter((value) => /app[\\/]resources[\\/][A-Za-z]:\\/.test(value));
const status = pathRows.length || malformedContextPaths.length || hookRows.length
  ? "FAIL"
  : unavailableServers.length
    ? "WARN"
    : "OK";
const report = {
  generated_at: new Date().toISOString(),
  status,
  mode: deepAudit ? "deep" : "fast",
  process_uuid: processUuid,
  latest_process_log_ts: latestProcess.latest_ts,
  mcp: {
    unavailable_servers: unavailableServers,
    event_count: unavailableRows.length,
  },
  hooks: {
    error_count: hookRows.length,
    recent: hookRows.slice(0, 5).map((row) => ({ ...row, feedback_log_body: sanitizeBody(row.feedback_log_body) })),
  },
  paths: {
    app_resources_windows_path_join_count: pathRows.length + malformedContextPaths.length,
    latest_turn_context_cwd: turnContext?.payload?.cwd || null,
    malformed_turn_context_paths: malformedContextPaths,
    recent: pathRows.slice(0, 5).map((row) => ({ ...row, feedback_log_body: sanitizeBody(row.feedback_log_body) })),
  },
};

database.close();

if (writeReport) {
  const outputDir = path.join(repoRoot, "outputs", "codex_runtime_audit");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (status === "FAIL") process.exitCode = 1;
