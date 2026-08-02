#!/usr/bin/env node

const endpoint = new URL(process.argv[2] || "https://138-68-66-30.sslip.io/mcp");
const protocol = "2025-03-26";

async function call(body, sessionId) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": protocol };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  const data = text.split(/\r?\n/).find((line) => line.startsWith("data:"));
  return { payload: JSON.parse(data ? data.slice(5).trim() : text), sessionId: response.headers.get("mcp-session-id") || sessionId };
}

const init = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: protocol, capabilities: {}, clientInfo: { name: "schema-probe", version: "1" } } });
const listed = await call({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, init.sessionId);
const names = new Set(["create_person", "update_person", "delete_person", "list_objects", "search"]);
const tools = listed.payload?.result?.tools || [];
console.log(JSON.stringify({ tools: tools.filter((tool) => names.has(tool.name)).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }, null, 2));
