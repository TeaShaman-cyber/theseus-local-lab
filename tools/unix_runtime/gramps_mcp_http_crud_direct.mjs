#!/usr/bin/env node

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractHandle, isSuccessfulReport, peopleCount, resultText } from "./gramps_mcp_http_crud_contract.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const endpoint = new URL(process.argv[2] || "https://138-68-66-30.sslip.io/mcp");
const protocol = "2025-03-26";
const outputDir = join(repoRoot, "outputs", "gramps_mcp_crud_direct");
const eventsPath = join(outputDir, "latest.jsonl");
const finalPath = join(outputDir, "latest.json");
const syntheticName = "Lad MCP Smoke Test";

mkdirSync(outputDir, { recursive: true });
writeFileSync(eventsPath, "", "utf8");

function log(event) { appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, "utf8"); }

async function rpc(body, sessionId) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": protocol, "user-agent": "theseus-family-gramps-mcp-http-crud-direct/1" };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data:"));
  const payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
  return { response, payload, sessionId: response.headers.get("mcp-session-id") || sessionId };
}

async function tool(id, name, args, sessionId) {
  const result = await rpc({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, sessionId);
  log({ id, tool: name, status: result.response.ok && !result.payload.error ? "passed" : "failed", error: result.payload.error?.message || null });
  return result;
}

const report = { initial_people_count: null, precondition: "unknown", create: "unknown", read: "unknown", update: "unknown", delete: "unknown", cleanup_status: "not_needed", final_people_count: null, synthetic_record_remains: true };
let createdHandle = null;
try {
  const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: protocol, capabilities: {}, clientInfo: { name: "theseus-crud-direct", version: "1" } } });
  if (!init.response.ok || init.payload.error) throw new Error("initialize failed");
  log({ id: 1, tool: "initialize", status: "passed" });
  let sessionId = init.sessionId;

  const initial = await tool(2, "list_objects", { objectType: "people", page: 1, pagesize: 100 }, sessionId);
  report.initial_people_count = peopleCount(initial.payload);

  const existing = await tool(3, "search", { query: syntheticName, page: 1, pagesize: 20 }, sessionId);
  const existingText = resultText(existing.payload);
  if (existingText.includes(`Person: ${syntheticName} — handle:`)) {
    report.precondition = "failed_existing_synthetic";
    throw new Error("synthetic test name already exists; refusing to create a duplicate");
  }
  report.precondition = "passed";

  const created = await tool(4, "create_person", { primaryName: syntheticName, gender: "Unknown" }, sessionId);
  const handle = extractHandle(created.payload);
  createdHandle = handle;
  report.create = created.response.ok && !created.payload.error && Boolean(handle) ? "passed" : "failed";

  if (handle) {
    const read = await tool(5, "get_person", { handle }, sessionId);
    report.read = read.response.ok && !read.payload.error ? "passed" : "failed";
    const updated = await tool(6, "update_person", { handle, primaryName: `${syntheticName} Updated` }, sessionId);
    report.update = updated.response.ok && !updated.payload.error ? "passed" : "failed";
    const readUpdated = await tool(7, "get_person", { handle }, sessionId);
    report.read = report.read === "passed" && readUpdated.response.ok && !readUpdated.payload.error ? "passed" : "failed";
    const deleted = await tool(8, "delete_person", { handle, force: false }, sessionId);
    report.delete = deleted.response.ok && !deleted.payload.error ? "passed" : "failed";
    if (report.delete === "passed") createdHandle = null;
  }

  const final = await tool(9, "list_objects", { objectType: "people", page: 1, pagesize: 100 }, sessionId);
  report.final_people_count = peopleCount(final.payload);
  report.synthetic_record_remains = report.final_people_count !== 0;
} catch (error) {
  log({ status: "error", error: String(error.message).slice(0, 300) });
} finally {
  if (createdHandle) {
    try {
      const cleanup = await tool(10, "delete_person", { handle: createdHandle, force: false }, null);
      report.cleanup_status = cleanup.response.ok && !cleanup.payload.error ? "passed" : "failed";
      if (report.cleanup_status === "passed") {
        report.delete = "passed";
        report.synthetic_record_remains = false;
      }
    } catch {
      report.cleanup_status = "failed";
    }
  } else if (report.create === "failed") {
    report.cleanup_status = "unknown";
  }
}

const success = isSuccessfulReport(report);
const output = { ok: success, ...report, events_path: eventsPath };
writeFileSync(finalPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify(output));
if (!success) process.exitCode = 1;
