#!/usr/bin/env node

const TIMEOUT_MS = 15_000;
const PROTOCOL_VERSION = "2025-03-26";

function endpointUrl(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new TypeError("endpoint must use http or https");
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/mcp";
  return url;
}

async function postJson(url, body, sessionId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      "user-agent": "theseus-family-gramps-mcp-http-protocol-probe/1",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const text = await response.text();
    const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data:"));
    let payload = null;
    try { payload = JSON.parse(dataLine ? dataLine.slice(5).trim() : text); } catch { /* status-only evidence */ }
    return {
      ok: response.ok && !payload?.error,
      status: response.status,
      content_type: response.headers.get("content-type"),
      session_id: response.headers.get("mcp-session-id"),
      payload,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeMcpProtocol(endpoint) {
  const url = endpointUrl(endpoint);
  const initialize = await postJson(url, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "theseus-family-probe", version: "1.0" },
    },
  });
  if (!initialize.ok) {
    return { ok: false, endpoint: url.toString(), stage: "initialize", status: initialize.status, content_type: initialize.content_type, error: initialize.payload?.error?.message || "initialize_failed" };
  }
  const sessionId = initialize.session_id;
  const listed = await postJson(url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, sessionId);
  const tools = listed.payload?.result?.tools;
  return {
    ok: listed.ok && Array.isArray(tools),
    endpoint: url.toString(),
    stage: "tools/list",
    status: listed.status,
    content_type: listed.content_type,
    session_present: Boolean(sessionId || listed.session_id),
    tool_count: Array.isArray(tools) ? tools.length : null,
    sample_tools: Array.isArray(tools) ? tools.slice(0, 8).map((tool) => tool.name).filter(Boolean) : [],
    error: listed.payload?.error?.message || null,
  };
}

if (process.argv[1]?.endsWith("gramps_mcp_http_protocol_probe.mjs")) {
  if (!process.argv[2]) {
    console.error("Usage: node tools/unix_runtime/gramps_mcp_http_protocol_probe.mjs <endpoint-url>");
    process.exitCode = 2;
  } else {
    try {
      const result = await probeMcpProtocol(process.argv[2]);
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
    } catch (error) {
      console.error(JSON.stringify({ ok: false, error: String(error.message).slice(0, 300) }));
      process.exitCode = 1;
    }
  }
}
