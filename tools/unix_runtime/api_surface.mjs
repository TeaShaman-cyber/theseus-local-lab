#!/usr/bin/env node

import https from "node:https";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://138-68-66-30.sslip.io";
const PATHS = ["/api/swagger-ui", "/api/metadata/"];

export function validateBaseUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new TypeError("base URL must be a bounded string");
  }
  const url = new URL(value);
  if (url.protocol !== "https:") throw new TypeError("base URL must use HTTPS");
  if (url.username || url.password) throw new TypeError("base URL must not contain credentials");
  url.pathname = url.pathname.replace(/\/$/, "");
  return url;
}

export function probeRoute(baseUrl, route, timeoutMs = 10_000) {
  const base = baseUrl instanceof URL ? baseUrl : validateBaseUrl(baseUrl);
  const url = new URL(route, `${base.origin}/`);
  return new Promise((resolve) => {
    const request = https.request(url, {
      method: "GET",
      timeout: timeoutMs,
      rejectUnauthorized: true,
      headers: { "user-agent": "theseus-family-api-surface-probe/1", accept: "text/html,application/json" },
    }, (response) => {
      response.resume();
      resolve({
        route,
        status_code: response.statusCode ?? null,
        content_type: response.headers["content-type"] ?? null,
        www_authenticate: response.headers["www-authenticate"] ?? null,
      });
    });
    request.on("timeout", () => request.destroy(new Error("request timeout")));
    request.on("error", (error) => resolve({
      route,
      status_code: null,
      content_type: null,
      www_authenticate: null,
      error: error.message.slice(0, 300),
    }));
    request.end();
  });
}

export async function probeApiSurface(baseUrl = DEFAULT_BASE_URL) {
  const base = validateBaseUrl(baseUrl);
  const routes = [];
  for (const route of PATHS) routes.push(await probeRoute(base, route));
  return { base_url: base.origin, credentialed: false, response_body_read: false, role_target: "Member", routes };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await probeApiSurface(process.argv[2] || DEFAULT_BASE_URL), null, 2));
}
