#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_HOST = "138.68.66.30";
const DEFAULT_USER = "root";
const TARGET_PORTS = new Set(["80", "443"]);

function safe(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:@-]+$/.test(value)) {
    throw new TypeError(`${field} must be a bounded SSH value`);
  }
  return value;
}

export function parseListeners(stdout) {
  return String(stdout).split(/\r?\n/).filter(Boolean).flatMap((line) => {
    const match = line.match(/\S+\s+\S+\s+([^\s]+):([0-9]+)\s+/);
    if (!match || !TARGET_PORTS.has(match[2])) return [];
    return [{ address: match[1], port: Number(match[2]), raw: line.slice(0, 300) }];
  });
}

function remote(host, user, args) {
  return new Promise((resolve) => {
    const child = spawn("ssh", [
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=yes",
      "-o", "ConnectTimeout=10",
      `${user}@${host}`,
      ...args,
    ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), 12_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: error.message.slice(0, 300), code: null });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 300), code });
    });
  });
}

export async function checkCaddy(host = DEFAULT_HOST, user = DEFAULT_USER) {
  const safeHost = safe(host, "host");
  const safeUser = safe(user, "user");
  const [service, listeners, version] = await Promise.all([
    remote(safeHost, safeUser, ["systemctl", "is-active", "caddy"]),
    remote(safeHost, safeUser, ["ss", "-ltnp"]),
    remote(safeHost, safeUser, ["caddy", "version"]),
  ]);
  const boundListeners = parseListeners(listeners.stdout);
  return {
    ok: service.stdout.trim() === "active" && [80, 443].every((port) => boundListeners.some((item) => item.port === port)),
    host: safeHost,
    user: safeUser,
    caddy_active: service.stdout.trim() === "active",
    caddy_state: service.stdout.trim().slice(0, 100),
    caddy_version: version.ok ? version.stdout.trim().split(/\r?\n/)[0].slice(0, 200) : null,
    listeners: boundListeners,
    errors: [service, listeners, version].filter((item) => !item.ok && item.stderr).map((item) => item.stderr),
  };
}

if (process.argv[1]?.endsWith("caddy_status.mjs")) {
  const result = await checkCaddy(process.argv[2] || DEFAULT_HOST, process.argv[3] || DEFAULT_USER);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
