#!/usr/bin/env node

import https from "node:https";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://138-68-66-30.sslip.io";
const MAX_URL_CHARS = 512;

export function validateEndpointUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_CHARS) {
    throw new TypeError("endpoint URL must be a bounded string");
  }
  const url = new URL(value);
  if (url.protocol !== "https:") throw new TypeError("endpoint URL must use HTTPS");
  if (url.username || url.password) throw new TypeError("endpoint URL must not contain credentials");
  return url;
}

export function checkEndpoint(value = DEFAULT_URL, timeoutMs = 10_000) {
  const url = validateEndpointUrl(value);
  return new Promise((resolve) => {
    const request = https.request(url, {
      method: "HEAD",
      timeout: timeoutMs,
      rejectUnauthorized: true,
      headers: { "user-agent": "theseus-family-endpoint-probe/1" },
    }, (response) => {
      response.resume();
      resolve({
        ok: response.statusCode >= 200 && response.statusCode < 400,
        status_code: response.statusCode ?? null,
        location: response.headers.location ?? null,
        content_type: response.headers["content-type"] ?? null,
        final_url: url.toString(),
      });
    });
    request.on("timeout", () => request.destroy(new Error("request timeout")));
    request.on("error", (error) => resolve({
      ok: false,
      status_code: null,
      location: null,
      content_type: null,
      final_url: url.toString(),
      error: error.message.slice(0, 300),
    }));
    request.end();
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await checkEndpoint(process.argv[2] || DEFAULT_URL);
  console.log(JSON.stringify({ endpoint: result.final_url, ...result }));
  if (!result.ok) process.exitCode = 1;
}
