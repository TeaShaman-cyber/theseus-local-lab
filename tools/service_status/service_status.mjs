#!/usr/bin/env node

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";
import { cwd, env, exit } from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const dockerEnv = {
  ...env,
  DOCKER_HOST: env.DOCKER_HOST || "tcp://127.0.0.1:2375",
};
const dockerConfig = path.join(repoRoot, "tools", "docker_control_plane", "docker-cli-config");
if (existsSync(dockerConfig)) {
  dockerEnv.DOCKER_CONFIG = dockerConfig;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith("--")) {
      const key = item.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = value;
    } else {
      args._.push(item);
    }
  }
  return args;
}

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs || 60_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}${stderr ? "\n" : ""}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function httpGet(url, timeoutMs = 8_000) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch {
          // Keep raw text.
        }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, body: parsed });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
  });
}

function tcpCheck(host, port, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok, error) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ok, host, port, error });
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false, "timeout"));
    socket.on("error", (error) => done(false, error.message));
  });
}

async function composePs(composeFile) {
  return run("docker", ["compose", "-f", composeFile, "ps"], { env: dockerEnv, timeoutMs: 30_000 });
}

async function composeLogs(composeFile, service, tail) {
  return run("docker", ["compose", "-f", composeFile, "logs", `--tail=${tail}`, service], {
    env: dockerEnv,
    timeoutMs: 30_000,
  });
}

function printSection(name, value) {
  console.log(`\n## ${name}`);
  if (typeof value === "string") {
    console.log(value.trim() || "(empty)");
  } else {
    console.log(JSON.stringify(value, null, 2));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  const tail = Math.max(1, Math.min(asInt(args.tail, 80), 500));

  if (command === "automem") {
    printSection("AutoMem API health", await httpGet("http://127.0.0.1:8001/health"));
    printSection("AutoMem compose ps", await composePs("work/automem/docker-compose.yml"));
    return;
  }

  if (command === "observatory") {
    printSection("Observatory compose ps", await composePs("stateful-agent-net/docker-compose.yml"));
    printSection("Observatory collector logs", await composeLogs("stateful-agent-net/docker-compose.yml", "collector", tail));
    return;
  }

  if (command === "backup") {
    printSection("Backup runner compose ps", await composePs("backup-lattice/docker-compose.yml"));
    printSection("Backup runner logs", await composeLogs("backup-lattice/docker-compose.yml", "backup-runner", tail));
    return;
  }

  if (command === "docker-control-health") {
    printSection("Docker control fallback health", await httpGet("http://127.0.0.1:8767/health"));
    return;
  }

  if (command === "port") {
    const host = String(args.host || "127.0.0.1");
    const port = asInt(args.port, 0);
    if (!port) throw new Error("--port is required");
    printSection("TCP port check", await tcpCheck(host, port));
    return;
  }

  console.log("Usage: node tools/service_status/service_status.mjs <automem|observatory|backup|docker-control-health|port>");
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
