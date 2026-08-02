#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_HOST = "138.68.66.30";
const DEFAULT_USER = "root";
const remoteWorkspace = "/root/workspaces/family-research-lab";
const remoteCompose = `${remoteWorkspace}/deploy/gramps-mcp/docker-compose.yml`;
const remoteComposeTmp = "/tmp/family-gramps-mcp-compose.yml";
const remoteCaddy = "/etc/caddy/Caddyfile";
const remoteCaddyTmp = "/tmp/family-caddyfile";
const remoteCaddyBackup = "/etc/caddy/Caddyfile.family-research.previous";

function safe(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:@-]+$/.test(value)) {
    throw new TypeError(`${field} must be a bounded SSH value`);
  }
  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !options.allowFailure) reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 500)}`));
      else resolvePromise({ code, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 500) });
    });
  });
}

function sshArgs(user, host, args) {
  return ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", `${user}@${host}`, ...args];
}

export function buildPlan(host = DEFAULT_HOST, user = DEFAULT_USER) {
  const safeHost = safe(host, "host");
  const safeUser = safe(user, "user");
  return {
    host: safeHost,
    user: safeUser,
    local_compose: "deploy/gramps-mcp/docker-compose.yml",
    local_caddy: "deploy/caddy/Caddyfile",
    steps: [
      "copy compose and Caddyfile to temporary remote paths",
      "validate temporary Caddyfile",
      "install compose and recreate only gramps_mcp",
      "preserve the current Caddyfile, install the candidate, and reload Caddy",
      "if reload fails, restore the previous Caddyfile and reload it",
      "probe HTTPS /mcp",
    ],
    rollback: {
      caddy_backup: remoteCaddyBackup,
      trigger: "non-zero Caddy reload",
    },
  };
}

export async function applyProfile(host = DEFAULT_HOST, user = DEFAULT_USER) {
  const safeHost = safe(host, "host");
  const safeUser = safe(user, "user");
  const compose = resolve(repoRoot, "deploy/gramps-mcp/docker-compose.yml");
  const caddy = resolve(repoRoot, "deploy/caddy/Caddyfile");
  const remote = `${safeUser}@${safeHost}`;

  await run("scp", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", compose, `${remote}:${remoteComposeTmp}`]);
  try {
    await run("scp", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", caddy, `${remote}:${remoteCaddyTmp}`]);
    await run("ssh", sshArgs(safeUser, safeHost, ["caddy", "validate", "--config", remoteCaddyTmp, "--adapter", "caddyfile"]));
    await run("ssh", sshArgs(safeUser, safeHost, ["install", "-m", "0644", remoteComposeTmp, remoteCompose]));
    await run("ssh", sshArgs(safeUser, safeHost, ["docker", "compose", "-f", remoteCompose, "up", "-d", "--force-recreate", "gramps_mcp"]));
    await run("ssh", sshArgs(safeUser, safeHost, ["cp", "-p", remoteCaddy, remoteCaddyBackup]));
    await run("ssh", sshArgs(safeUser, safeHost, ["install", "-m", "0644", remoteCaddyTmp, remoteCaddy]));

    const reload = await run("ssh", sshArgs(safeUser, safeHost, ["caddy", "reload", "--config", remoteCaddy, "--adapter", "caddyfile"]), { allowFailure: true });
    if (reload.code !== 0) {
      const restore = await run("ssh", sshArgs(safeUser, safeHost, ["install", "-m", "0644", remoteCaddyBackup, remoteCaddy]), { allowFailure: true });
      const rollbackReload = restore.code === 0
        ? await run("ssh", sshArgs(safeUser, safeHost, ["caddy", "reload", "--config", remoteCaddy, "--adapter", "caddyfile"]), { allowFailure: true })
        : { code: restore.code };
      if (rollbackReload.code !== 0) {
        throw new Error("Caddy reload failed and rollback reload also failed");
      }
      throw new Error("Caddy reload failed; previous Caddyfile restored");
    }
  } finally {
    await run("ssh", sshArgs(safeUser, safeHost, ["rm", "-f", remoteComposeTmp, remoteCaddyTmp]), { allowFailure: true });
  }
  return { ok: true, host: safeHost, user: safeUser, compose: remoteCompose, caddy: remoteCaddy };
}

if (process.argv[1]?.endsWith("gramps_mcp_http_apply.mjs")) {
  const host = process.argv[2] || DEFAULT_HOST;
  const user = process.argv[3] || DEFAULT_USER;
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", ...buildPlan(host, user) }, null, 2));
  } else {
    try {
      console.log(JSON.stringify(await applyProfile(host, user)));
    } catch (error) {
      console.error(JSON.stringify({ ok: false, error: String(error.message).slice(0, 500) }));
      process.exitCode = 1;
    }
  }
}
