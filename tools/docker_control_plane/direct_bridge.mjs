#!/usr/bin/env node

import { spawn } from "node:child_process";
import { stdin, stdout, env, cwd } from "node:process";
import { resolve, relative, isAbsolute } from "node:path";

const PROJECT_ROOT = resolve(env.THESEUS_PROJECT_ROOT || cwd());
// DOCKER_HOST is optional for legacy compatibility. With it unset, Docker uses
// the active native context: Desktop's context on Windows or the Unix socket in WSL.
const DOCKER_HOST = env.DOCKER_HOST || null;
const DOCKER_CONTEXT = DOCKER_HOST || "default Docker context";
const MAX_OUTPUT_CHARS = 80_000;

const tools = [
  {
    name: "docker_tcp_health",
    description: "Compatibility alias: check reachability through the active Docker context.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "docker_ps",
    description: "List running Docker containers through the active Docker context.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "docker_logs",
    description: "Read recent logs for one container. Container name/id is restricted to safe characters.",
    inputSchema: {
      type: "object",
      properties: {
        container: { type: "string" },
        tail: { type: "integer", minimum: 1, maximum: 500, default: 80 },
      },
      required: ["container"],
      additionalProperties: false,
    },
  },
  {
    name: "docker_compose_ps",
    description: "Run docker compose ps for a project-relative compose file.",
    inputSchema: {
      type: "object",
      properties: {
        composeFile: { type: "string", default: "work/automem/docker-compose.yml" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker_compose_logs",
    description: "Read recent docker compose logs for a project-relative compose file and optional service.",
    inputSchema: {
      type: "object",
      properties: {
        composeFile: { type: "string", default: "work/automem/docker-compose.yml" },
        service: { type: "string" },
        tail: { type: "integer", minimum: 1, maximum: 500, default: 80 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker_compose_up_service",
    description: "Start or rebuild one compose service from a project-relative compose file.",
    inputSchema: {
      type: "object",
      properties: {
        composeFile: { type: "string", default: "work/automem/docker-compose.yml" },
        service: { type: "string" },
        build: { type: "boolean", default: false },
      },
      required: ["service"],
      additionalProperties: false,
    },
  },
];

function write(message) {
  stdout.write(`${JSON.stringify(message)}\n`);
}

function textContent(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
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

function safeName(input, label) {
  const value = String(input || "").trim();
  if (!/^[a-zA-Z0-9_.:-]+$/.test(value)) {
    throw new Error(`invalid_${label}`);
  }
  return value;
}

function runDocker(args, options = {}) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    const child = spawn("docker", args, {
      cwd: options.cwd || PROJECT_ROOT,
      shell: false,
      windowsHide: true,
      env: DOCKER_HOST ? { ...env, DOCKER_HOST } : { ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let killed = false;
    const timeout = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, options.timeoutMs || 60_000);

    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      if (out.length > MAX_OUTPUT_CHARS) out = out.slice(-MAX_OUTPUT_CHARS);
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
      if (err.length > MAX_OUTPUT_CHARS) err = err.slice(-MAX_OUTPUT_CHARS);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolveRun({
        ok: false,
        docker_host: DOCKER_CONTEXT,
        args,
        code: null,
        signal: null,
        duration_ms: Date.now() - startedAt,
        stdout: out,
        stderr: `${err}${err ? "\n" : ""}${error.message}`,
        killed,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolveRun({
        ok: code === 0 && !killed,
        docker_host: DOCKER_CONTEXT,
        args,
        code,
        signal,
        duration_ms: Date.now() - startedAt,
        stdout: out,
        stderr: err,
        killed,
      });
    });
  });
}

async function callTool(name, args = {}) {
  if (name === "docker_tcp_health") {
    return runDocker(["version", "--format", "{{json .}}"], { timeoutMs: 20_000 });
  }
  if (name === "docker_ps") {
    return runDocker(["ps", "--format", "{{json .}}"], { timeoutMs: 20_000 });
  }
  if (name === "docker_logs") {
    const container = safeName(args.container, "container_name");
    const tail = safeTail(args.tail, 80);
    return runDocker(["logs", `--tail=${tail}`, container], { timeoutMs: 30_000 });
  }
  if (name === "docker_compose_ps") {
    const composeFile = safeRelativePath(args.composeFile, "work/automem/docker-compose.yml");
    return runDocker(["compose", "-f", composeFile, "ps"], { timeoutMs: 30_000 });
  }
  if (name === "docker_compose_logs") {
    const composeFile = safeRelativePath(args.composeFile, "work/automem/docker-compose.yml");
    const tail = safeTail(args.tail, 80);
    const dockerArgs = ["compose", "-f", composeFile, "logs", `--tail=${tail}`];
    if (args.service) dockerArgs.push(safeName(args.service, "service_name"));
    return runDocker(dockerArgs, { timeoutMs: 30_000 });
  }
  if (name === "docker_compose_up_service") {
    const composeFile = safeRelativePath(args.composeFile, "work/automem/docker-compose.yml");
    const service = safeName(args.service, "service_name");
    const dockerArgs = ["compose", "-f", composeFile, "up", "-d"];
    if (args.build) dockerArgs.push("--build");
    dockerArgs.push(service);
    return runDocker(dockerArgs, { timeoutMs: 120_000 });
  }
  throw new Error(`unknown_tool:${name}`);
}

async function handle(method, params) {
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "theseus-docker-context-bridge", version: "0.2.0" },
    };
  }
  if (method === "tools/list") {
    return { tools };
  }
  if (method === "tools/call") {
    return textContent(await callTool(params?.name, params?.arguments || {}));
  }
  if (method === "shutdown") {
    return {};
  }
  if (method === "exit") {
    process.exit(0);
  }
  return {};
}

let buffer = "";
stdin.setEncoding("utf8");
stdin.on("end", () => process.exit(0));
stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) processLine(line);
  }
});

async function processLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (!Object.hasOwn(message, "id")) return;
  try {
    write({ jsonrpc: "2.0", id: message.id, result: await handle(message.method, message.params) });
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32000, message: error.message },
    });
  }
}
