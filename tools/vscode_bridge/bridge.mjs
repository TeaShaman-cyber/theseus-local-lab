#!/usr/bin/env node
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const queueRoot = join(root, "work", "vscode_bridge");
const inbox = join(queueRoot, "inbox");
const processing = join(queueRoot, "processing");
const outbox = join(queueRoot, "outbox");
const heartbeatPath = join(queueRoot, "heartbeat.json");
const maxOutputChars = 20000;

const allowlist = {
  git_status: {
    cmd: "git",
    args: ["status", "-sb"],
  },
  scan_staged: {
    cmd: "node",
    args: ["tools/git_safety/scan_staged.mjs"],
  },
  commit_checkpoint_default: {
    cmd: "node",
    args: ["tools/git_safety/commit_checkpoint.mjs"],
    timeoutMs: 120000,
  },
  commit_checkpoint: {
    cmd: "node",
    args: (request) => {
      const message = String(request.message || "").trim();
      if (!message) throw new Error("commit_checkpoint requires a non-empty message");
      return ["tools/git_safety/commit_checkpoint.mjs", "--message", message];
    },
    timeoutMs: 120000,
  },
  docker_tcp_ps: {
    cmd: "docker",
    args: ["ps", "--format", "{{json .}}"],
    env: { DOCKER_HOST: "tcp://127.0.0.1:2375" },
  },
};

function now() {
  return new Date().toISOString();
}

async function ensureDirs() {
  await mkdir(inbox, { recursive: true });
  await mkdir(processing, { recursive: true });
  await mkdir(outbox, { recursive: true });
}

function truncate(text) {
  if (text.length <= maxOutputChars) return text;
  return `${text.slice(0, maxOutputChars)}\n[truncated ${text.length - maxOutputChars} chars]`;
}

function runProcess(spec, request) {
  return new Promise((resolve) => {
    const args = typeof spec.args === "function" ? spec.args(request) : spec.args;
    const child = spawn(spec.cmd, args, {
      cwd: root,
      shell: false,
      env: { ...process.env, ...(spec.env || {}) },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        child.kill();
        settled = true;
        resolve({
          ok: false,
          code: null,
          signal: "timeout",
          stdout: truncate(stdout),
          stderr: truncate(`${stderr}\nTimed out after ${spec.timeoutMs || 60000} ms`),
        });
      }
    }, spec.timeoutMs || 60000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      resolve({ ok: false, code: null, stdout: truncate(stdout), stderr: String(error.message) });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      resolve({
        ok: code === 0,
        code,
        signal,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
      });
    });
  });
}

async function writeHeartbeat(state = "idle") {
  await writeFile(
    heartbeatPath,
    JSON.stringify(
      {
        ts: now(),
        state,
        pid: process.pid,
        allowlist: Object.keys(allowlist),
      },
      null,
      2,
    ),
  );
}

async function processOne(file) {
  const source = join(inbox, file);
  const claimed = join(processing, file);
  try {
    await rename(source, claimed);
  } catch {
    return false;
  }

  let request;
  let result;
  try {
    request = JSON.parse(await readFile(claimed, "utf8"));
    const command = request.command;
    if (!Object.hasOwn(allowlist, command)) {
      throw new Error(`Command is not allowlisted: ${command}`);
    }
    await writeHeartbeat(`running:${command}`);
    const startedAt = now();
    const processResult = await runProcess(allowlist[command], request);
    result = {
      id: request.id,
      command,
      ok: processResult.ok,
      startedAt,
      finishedAt: now(),
      ...processResult,
    };
  } catch (error) {
    result = {
      id: request?.id || basename(file, ".json"),
      command: request?.command || "unknown",
      ok: false,
      startedAt: request?.createdAt || now(),
      finishedAt: now(),
      stdout: "",
      stderr: String(error?.stack || error?.message || error),
    };
  }

  await writeFile(join(outbox, `${result.id}.json`), JSON.stringify(result, null, 2));
  await writeHeartbeat("idle");
  return true;
}

async function worker() {
  await ensureDirs();
  await writeHeartbeat("starting");
  console.log(`[${now()}] Theseus IDE Bridge worker started`);
  console.log(`Queue: ${queueRoot}`);
  console.log(`Allowlist: ${Object.keys(allowlist).join(", ")}`);

  while (true) {
    await writeHeartbeat("idle");
    const files = (await readdir(inbox)).filter((name) => name.endsWith(".json")).sort();
    if (files.length > 0) {
      await processOne(files[0]);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function enqueue(argv) {
  await ensureDirs();
  const command = argv[0];
  if (!command || !Object.hasOwn(allowlist, command)) {
    throw new Error(`Usage: bridge.mjs enqueue <${Object.keys(allowlist).join("|")}> [--message text] [--wait ms]`);
  }

  let waitMs = 0;
  let message = "";
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === "--wait") {
      waitMs = Number(argv[++i] || "0");
    } else if (argv[i] === "--message") {
      message = String(argv[++i] || "");
    } else {
      throw new Error(`Unknown option: ${argv[i]}`);
    }
  }

  const id = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
  const request = { id, command, message, createdAt: now() };
  await writeFile(join(inbox, `${id}.json`), JSON.stringify(request, null, 2));
  console.log(JSON.stringify({ queued: true, id, command, inbox }, null, 2));

  if (!waitMs) return;
  const resultPath = join(outbox, `${id}.json`);
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (existsSync(resultPath)) {
      console.log(await readFile(resultPath, "utf8"));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${id}`);
}

async function status() {
  await ensureDirs();
  const heartbeat = existsSync(heartbeatPath) ? JSON.parse(await readFile(heartbeatPath, "utf8")) : null;
  const pending = (await readdir(inbox)).filter((name) => name.endsWith(".json")).length;
  const inFlight = (await readdir(processing)).filter((name) => name.endsWith(".json")).length;
  const completed = (await readdir(outbox)).filter((name) => name.endsWith(".json")).length;
  let heartbeatAgeMs = null;
  if (heartbeat) {
    heartbeatAgeMs = Date.now() - (await stat(heartbeatPath)).mtimeMs;
  }
  console.log(JSON.stringify({ heartbeat, heartbeatAgeMs, pending, inFlight, completed }, null, 2));
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === "worker") {
    await worker();
  } else if (mode === "enqueue") {
    await enqueue(rest);
  } else if (mode === "status") {
    await status();
  } else {
    throw new Error("Usage: bridge.mjs worker | enqueue | status");
  }
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
}
