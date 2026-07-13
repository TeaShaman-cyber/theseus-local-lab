#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve, relative, isAbsolute } from "node:path";
import { cwd, env } from "node:process";

const HOST = env.THESEUS_DOCKER_CONTROL_HOST || "127.0.0.1";
const PORT = Number.parseInt(env.THESEUS_DOCKER_CONTROL_PORT || "8767", 10);
const TOKEN = env.THESEUS_DOCKER_BRIDGE_TOKEN || "";
const PROJECT_ROOT = resolve(env.THESEUS_PROJECT_ROOT || cwd());
const MAX_OUTPUT_CHARS = 80_000;

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 32_000) {
        reject(new Error("request_body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requireToken(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function safeTail(value, fallback = 80) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 500));
}

function safeRelativePath(input, fallback) {
  const value = String(input || fallback || "").trim();
  if (!value || isAbsolute(value)) {
    throw new Error("path_must_be_relative");
  }
  const resolved = resolve(PROJECT_ROOT, value);
  const rel = relative(PROJECT_ROOT, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("path_outside_project");
  }
  return resolved;
}

function safeServiceName(input) {
  const value = String(input || "").trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    throw new Error("invalid_service_name");
  }
  return value;
}

function safeContainerName(input) {
  const value = String(input || "").trim();
  if (!/^[a-zA-Z0-9_.:-]+$/.test(value)) {
    throw new Error("invalid_container_name");
  }
  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd || PROJECT_ROOT,
      shell: false,
      windowsHide: true,
      env: { ...env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    const timeout = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, options.timeoutMs || 60_000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_OUTPUT_CHARS) {
        stdout = stdout.slice(-MAX_OUTPUT_CHARS);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > MAX_OUTPUT_CHARS) {
        stderr = stderr.slice(-MAX_OUTPUT_CHARS);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolveRun({
        ok: false,
        command,
        args,
        code: null,
        signal: null,
        duration_ms: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}${stderr ? "\n" : ""}${error.message}`,
        killed,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolveRun({
        ok: code === 0 && !killed,
        command,
        args,
        code,
        signal,
        duration_ms: Date.now() - startedAt,
        stdout,
        stderr,
        killed,
      });
    });
  });
}

async function handleAction(body) {
  const action = String(body.action || "");
  if (action === "health") {
    const docker = await run("docker", ["version", "--format", "{{json .}}"], {
      timeoutMs: 20_000,
    });
    return {
      ok: docker.ok,
      daemon: "theseus-docker-control-plane",
      project_root: PROJECT_ROOT,
      docker,
    };
  }

  if (action === "docker_ps") {
    return run("docker", ["ps", "--format", "{{json .}}"], { timeoutMs: 20_000 });
  }

  if (action === "docker_logs") {
    const container = safeContainerName(body.container);
    const tail = safeTail(body.tail, 80);
    return run("docker", ["logs", `--tail=${tail}`, container], { timeoutMs: 30_000 });
  }

  if (action === "docker_compose_ps") {
    const composeFile = safeRelativePath(body.composeFile, "work/automem/docker-compose.yml");
    return run("docker", ["compose", "-f", composeFile, "ps"], { timeoutMs: 30_000 });
  }

  if (action === "docker_compose_logs") {
    const composeFile = safeRelativePath(body.composeFile, "work/automem/docker-compose.yml");
    const tail = safeTail(body.tail, 80);
    const args = ["compose", "-f", composeFile, "logs", `--tail=${tail}`];
    if (body.service) args.push(safeServiceName(body.service));
    return run("docker", args, { timeoutMs: 30_000 });
  }

  if (action === "docker_compose_up_service") {
    const composeFile = safeRelativePath(body.composeFile, "work/automem/docker-compose.yml");
    const service = safeServiceName(body.service);
    const args = ["compose", "-f", composeFile, "up", "-d"];
    if (body.build) args.push("--build");
    args.push(service);
    return run("docker", args, { timeoutMs: 120_000 });
  }

  throw new Error(`unknown_action:${action}`);
}

const server = createServer(async (req, res) => {
  try {
    if (!requireToken(req)) {
      jsonResponse(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      jsonResponse(res, 200, await handleAction({ action: "health" }));
      return;
    }
    if (req.method === "POST" && req.url === "/action") {
      const body = await readBody(req);
      jsonResponse(res, 200, await handleAction(body));
      return;
    }
    jsonResponse(res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    jsonResponse(res, 400, { ok: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      ok: true,
      daemon: "theseus-docker-control-plane",
      url: `http://${HOST}:${PORT}`,
      project_root: PROJECT_ROOT,
      token_required: Boolean(TOKEN),
    }),
  );
});

