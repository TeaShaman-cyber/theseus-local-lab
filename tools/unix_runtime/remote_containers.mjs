#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_HOST = "138.68.66.30";
const DEFAULT_USER = "root";
const MAX_OUTPUT_CHARS = 8_000;

function safe(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:@-]+$/.test(value)) {
    throw new TypeError(`${field} must be a bounded SSH value`);
  }
  return value;
}

export function parseContainerRows(stdout) {
  return String(stdout)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        const row = JSON.parse(line);
        return {
          name: row.Names ?? null,
          image: row.Image ?? null,
          status: row.Status ?? null,
          ports: row.Ports ?? null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function checkRemoteContainers(host = DEFAULT_HOST, user = DEFAULT_USER) {
  const safeHost = safe(host, "host");
  const safeUser = safe(user, "user");
  return new Promise((resolve) => {
    const child = spawn("ssh", [
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=yes",
      "-o", "ConnectTimeout=10",
      `${safeUser}@${safeHost}`,
      "docker",
      "ps",
      "--format '{{json .}}'",
    ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), 12_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, host: safeHost, user: safeUser, containers: [], error: error.message.slice(0, 300) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        host: safeHost,
        user: safeUser,
        containers: parseContainerRows(stdout.slice(0, MAX_OUTPUT_CHARS)),
        error: code === 0 ? null : stderr.slice(0, 300),
      });
    });
  });
}

if (process.argv[1]?.endsWith("remote_containers.mjs")) {
  const result = await checkRemoteContainers(process.argv[2] || DEFAULT_HOST, process.argv[3] || DEFAULT_USER);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
