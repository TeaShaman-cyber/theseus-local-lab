#!/usr/bin/env node

import { stdin, stdout, env } from "node:process";

const CONTROL_URL = (env.THESEUS_DOCKER_CONTROL_URL || "http://127.0.0.1:8767").replace(/\/$/, "");
const TOKEN = env.THESEUS_DOCKER_BRIDGE_TOKEN || "";

const tools = [
  {
    name: "docker_control_health",
    description: "Check the user-context Theseus Docker control daemon and Docker Desktop reachability.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "docker_ps",
    description: "List running Docker containers through the user-context Docker control daemon.",
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
    description: "Run docker compose ps for an allowlisted relative compose file under the project root.",
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
    description: "Start or rebuild one compose service from a project-relative compose file. No arbitrary Docker command execution.",
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

async function callControl(action, args = {}) {
  const response = await fetch(`${CONTROL_URL}/action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ action, ...args }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `control_http_${response.status}`);
  }
  return payload;
}

async function handle(method, params) {
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "theseus-docker-bridge", version: "0.1.0" },
    };
  }
  if (method === "tools/list") {
    return { tools };
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    const mapping = {
      docker_control_health: "health",
      docker_ps: "docker_ps",
      docker_logs: "docker_logs",
      docker_compose_ps: "docker_compose_ps",
      docker_compose_logs: "docker_compose_logs",
      docker_compose_up_service: "docker_compose_up_service",
    };
    if (!mapping[name]) {
      throw new Error(`unknown_tool:${name}`);
    }
    return textContent(await callControl(mapping[name], args));
  }
  return {};
}

let buffer = "";
stdin.setEncoding("utf8");
stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    processLine(line);
  }
});

async function processLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (!Object.hasOwn(message, "id")) {
    return;
  }
  try {
    write({ jsonrpc: "2.0", id: message.id, result: await handle(message.method, message.params) });
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32000,
        message: error.message,
      },
    });
  }
}

