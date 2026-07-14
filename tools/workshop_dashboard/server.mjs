#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPreflightBundles, buildTaskCatalog, buildTaskGraph, rankTaskRoutes } from "./tasks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");
const port = Number(process.env.PORT || 5180);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
]);

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function runDashboard() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, "dashboard.mjs"), "--json"], {
      cwd: path.resolve(here, "..", ".."),
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 20_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const dashboard = JSON.parse(stdout);
        resolve({ ok: code === 0 || dashboard.overall, dashboard, code, stderr });
      } catch (error) {
        resolve({ ok: false, code, stderr, stdout: stdout.slice(0, 1000), error: error.message });
      }
    });
  });
}

function readCodexIssues() {
  const filePath = path.resolve(here, "..", "..", "outputs", "github_issue_watch", "openai-codex.json");
  if (!existsSync(filePath)) {
    return {
      ok: false,
      error: "issue summary cache not found",
      hint: "Run node tools/github_issue_watch/github_issue_watch.mjs --write",
    };
  }
  return {
    ok: true,
    ...JSON.parse(readFileSync(filePath, "utf8")),
  };
}

function readCodexSystem() {
  const filePath = path.resolve(here, "..", "..", "outputs", "codex_system_watch", "codex-system.json");
  if (!existsSync(filePath)) {
    return {
      ok: false,
      error: "Codex system cache not found",
      hint: "Run node tools/codex_system_watch/codex_system_watch.mjs --write",
    };
  }
  return {
    ok: true,
    ...JSON.parse(readFileSync(filePath, "utf8")),
  };
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    jsonResponse(res, 404, { ok: false, error: "not found" });
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, {
    "content-type": contentTypes.get(ext) || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") {
    jsonResponse(res, 200, { ok: true, service: "theseus-workshop-dashboard" });
    return;
  }
  if (url.pathname === "/api/dashboard") {
    const result = await runDashboard();
    if (!result.ok && !result.dashboard) {
      jsonResponse(res, 503, result);
      return;
    }
    jsonResponse(res, 200, result.dashboard);
    return;
  }
  if (url.pathname === "/api/tasks") {
    try {
      jsonResponse(res, 200, buildTaskCatalog());
    } catch (error) {
      jsonResponse(res, 503, { ok: false, error: error.message });
    }
    return;
  }
  if (url.pathname === "/api/task-graph") {
    try {
      jsonResponse(res, 200, buildTaskGraph(url.searchParams.get("goal") || ""));
    } catch (error) {
      jsonResponse(res, 503, { ok: false, error: error.message });
    }
    return;
  }
  if (url.pathname === "/api/task-route") {
    try {
      jsonResponse(res, 200, rankTaskRoutes(url.searchParams.get("goal") || "", 10));
    } catch (error) {
      jsonResponse(res, 503, { ok: false, error: error.message });
    }
    return;
  }
  if (url.pathname === "/api/task-bundles") {
    try {
      jsonResponse(res, 200, buildPreflightBundles());
    } catch (error) {
      jsonResponse(res, 503, { ok: false, error: error.message });
    }
    return;
  }
  if (url.pathname === "/api/codex-issues") {
    try {
      jsonResponse(res, 200, readCodexIssues());
    } catch (error) {
      jsonResponse(res, 503, { ok: false, error: error.message });
    }
    return;
  }
  if (url.pathname === "/api/codex-system") {
    try {
      jsonResponse(res, 200, readCodexSystem());
    } catch (error) {
      jsonResponse(res, 503, { ok: false, error: error.message });
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`theseus workshop dashboard listening on 0.0.0.0:${port}`);
});
