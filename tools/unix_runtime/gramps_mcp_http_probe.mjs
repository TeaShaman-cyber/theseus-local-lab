#!/usr/bin/env node

const DEFAULT_PATH = "/mcp";
const TIMEOUT_MS = 10_000;

function normalizeUrl(value, path = DEFAULT_PATH) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new TypeError("endpoint must use http or https");
  if (url.pathname === "/" || url.pathname === "") url.pathname = path;
  return url;
}

export async function probeMcpHttp(endpoint, path = DEFAULT_PATH) {
  const url = normalizeUrl(endpoint, path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "theseus-family-gramps-mcp-http-probe/1", accept: "application/json,text/event-stream" },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const webFallback = response.status === 200 && /text\/html/i.test(contentType);
    const mcpCandidate = !webFallback && (response.status !== 404);
    return {
      ok: true,
      endpoint: url.toString(),
      status: response.status,
      content_type: contentType || null,
      reachable: true,
      mcp_candidate: mcpCandidate,
      note: response.status === 404 ? "endpoint_not_published" : webFallback ? "web_ui_fallback" : "endpoint_reachable",
    };
  } catch (error) {
    return {
      ok: false,
      endpoint: url.toString(),
      status: null,
      content_type: null,
      reachable: false,
      mcp_candidate: false,
      error: error.name === "AbortError" ? "timeout" : String(error.message).slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
}

if (process.argv[1]?.endsWith("gramps_mcp_http_probe.mjs")) {
  if (!process.argv[2]) {
    console.error("Usage: node tools/unix_runtime/gramps_mcp_http_probe.mjs <base-or-endpoint-url> [path]");
    process.exitCode = 2;
  } else {
    const result = await probeMcpHttp(process.argv[2], process.argv[3] || DEFAULT_PATH);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  }
}
