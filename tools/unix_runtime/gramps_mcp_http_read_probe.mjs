#!/usr/bin/env node

const TIMEOUT_MS = 15_000;
const PROTOCOL_VERSION = "2025-03-26";

async function rpc(url, body, sessionId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      "user-agent": "theseus-family-gramps-mcp-http-read-probe/1",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const text = await response.text();
    const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data:"));
    let payload = null;
    try { payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text); } catch { /* status-only evidence */ }
    return { response, payload, sessionId: response.headers.get("mcp-session-id") || sessionId };
  } finally {
    clearTimeout(timer);
  }
}

export async function readProbe(endpoint, query = "Lad MCP Smoke Test") {
  const url = new URL(endpoint);
  const init = await rpc(url, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "theseus-read-probe", version: "1.0" } },
  });
  if (!init.response.ok || init.payload?.error) return { ok: false, stage: "initialize", status: init.response.status, error: init.payload?.error?.message || "initialize_failed" };

  const metadata = await rpc(url, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_metadata", arguments: {} } }, init.sessionId);
  const search = await rpc(url, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search", arguments: { query } } }, metadata.sessionId);
  const metadataText = metadata.payload?.result?.content?.find((item) => item.type === "text")?.text || "";
  const searchText = search.payload?.result?.content?.find((item) => item.type === "text")?.text || "";
  const peopleMatch = metadataText.match(/People\s+([0-9]+)/i);
  const searchValues = [];
  const collect = (value) => {
    if (typeof value === "string") searchValues.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(search.payload?.result);
  const candidateHandle = searchValues.join(" ").match(/[0-9a-f]{20,}/i)?.[0] || null;
  return {
    ok: metadata.response.ok && search.response.ok && !metadata.payload?.error && !search.payload?.error,
    stage: "read_checks",
    metadata_status: metadata.response.status,
    search_status: search.response.status,
    people_count: peopleMatch ? Number(peopleMatch[1]) : null,
    search_response_has_query_echo: /Lad MCP Smoke Test/i.test(searchText),
    synthetic_match_remains: peopleMatch ? Number(peopleMatch[1]) > 0 : null,
    candidate_handle: candidateHandle,
  };
}

if (process.argv[1]?.endsWith("gramps_mcp_http_read_probe.mjs")) {
  if (!process.argv[2]) {
    console.error("Usage: node tools/unix_runtime/gramps_mcp_http_read_probe.mjs <endpoint-url> [query]");
    process.exitCode = 2;
  } else {
    try {
      const result = await readProbe(process.argv[2], process.argv[3] || "Lad MCP Smoke Test");
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
    } catch (error) {
      console.error(JSON.stringify({ ok: false, error: String(error.message).slice(0, 300) }));
      process.exitCode = 1;
    }
  }
}
