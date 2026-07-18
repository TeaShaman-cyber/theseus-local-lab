#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { cwd, env, exit } from "node:process";

const bridgePath = resolve(cwd(), "tools/docker_control_plane/direct_bridge.mjs");
const useLegacyTcp = process.argv.includes("--legacy-tcp");
const child = spawn("node", [bridgePath], {
  cwd: cwd(),
  shell: false,
  windowsHide: true,
  env: {
    ...env,
    ...(useLegacyTcp ? { DOCKER_HOST: env.DOCKER_HOST || "tcp://127.0.0.1:2375" } : {}),
    THESEUS_PROJECT_ROOT: env.THESEUS_PROJECT_ROOT || cwd(),
  },
  stdio: ["pipe", "pipe", "pipe"],
});

const pending = new Map();
let buffer = "";
let stderr = "";

function send(id, method, params = {}) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolveResponse, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout:${method}`));
    }, 15_000);
    pending.set(id, { resolveResponse, reject, timer, method });
  });
}

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (!Object.hasOwn(message, "id")) continue;
    const item = pending.get(message.id);
    if (!item) continue;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) {
      item.reject(new Error(`${item.method}:${message.error.message}`));
    } else {
      item.resolveResponse(message.result);
    }
  }
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

try {
  const init = await send(1, "initialize");
  const list = await send(2, "tools/list");
  const health = await send(3, "tools/call", {
    name: "docker_tcp_health",
    arguments: {},
  });
  child.stdin.end();
  const healthText = health.content?.[0]?.text || "{}";
  const healthPayload = JSON.parse(healthText);
  console.log(
    JSON.stringify(
      {
        ok: Boolean(init.serverInfo && list.tools?.length && healthPayload.ok),
        server: init.serverInfo,
        tool_count: list.tools?.length || 0,
        route: useLegacyTcp ? "legacy-tcp" : "active-context",
        docker_host: healthPayload.docker_host,
        docker_code: healthPayload.code,
      },
      null,
      2,
    ),
  );
} catch (error) {
  child.kill("SIGTERM");
  console.error(JSON.stringify({ ok: false, error: error.message, stderr }, null, 2));
  exit(1);
}
