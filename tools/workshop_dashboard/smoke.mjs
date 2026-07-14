#!/usr/bin/env node

const baseUrl = process.env.THESEUS_DASHBOARD_URL || "http://127.0.0.1:5180";

async function get(path, format = "text") {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return format === "json" ? response.json() : response.text();
}

const [dashboard, usage, html, script] = await Promise.all([
  get("/api/dashboard", "json"),
  get("/api/usage-scout", "json"),
  get("/"),
  get("/app.js"),
]);

const main = dashboard.rows?.find((row) => row.id === "usage-scout");
const checks = {
  main_status_visible: ["OK", "WARN", "FAIL"].includes(main?.status),
  usage_api: usage.ok === true && Array.isArray(usage.limits),
  limits_tab: html.includes('href="#limits"'),
  limits_view: html.includes('id="limits-view"'),
  limits_renderer: script.includes("refreshUsageScout"),
};

if (Object.values(checks).some((ok) => !ok)) {
  console.error(JSON.stringify({ ok: false, checks, main }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checks,
      model: usage.codex?.model || null,
      reasoning_effort: usage.codex?.reasoning_effort || null,
      used_percent: usage.limits?.find((limit) => limit.key === usage.derived?.binding_limit_key)?.used_percent ?? null,
      main_status: main.status,
    },
    null,
    2,
  ),
);
