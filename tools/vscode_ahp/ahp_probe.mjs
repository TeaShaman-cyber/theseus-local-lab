#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const root = process.cwd();
const stateDir = join(root, "work", "vscode_ahp");
const tokenPath = join(stateDir, "token.txt");
const hostLogPath = join(stateDir, "host.log");
const defaultTimeoutMs = 30000;

function codeCommand() {
  if (process.env.VSCODE_CLI) return process.env.VSCODE_CLI;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const localCodeCmd = join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "bin", "code.cmd");
    if (existsSync(localCodeCmd)) return localCodeCmd;
  }
  return process.platform === "win32" ? "code.cmd" : "code";
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const isCmd = process.platform === "win32" && command.endsWith(".cmd");
    const childCommand = isCmd ? "cmd.exe" : command;
    const childArgs = isCmd ? ["/d", "/c", "call", command, ...args] : args;
    const stdio = options.stdoutFile
      ? ["ignore", "pipe", "pipe"]
      : options.inherit
        ? "inherit"
        : ["ignore", "pipe", "pipe"];
    const child = spawn(childCommand, childArgs, {
      cwd: root,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...(options.env || {}) },
      stdio,
    });

    if (options.stdoutFile) {
      const stream = createWriteStream(options.stdoutFile, { flags: "a" });
      child.stdout.on("data", (chunk) => stream.write(chunk));
      child.stderr.on("data", (chunk) => stream.write(chunk));
      child.on("close", () => stream.end());
    }

    if (options.inherit || options.stdoutFile) {
      child.on("close", (code, signal) => resolve({ code, signal, stdout: "", stderr: "" }));
      child.on("error", (error) => resolve({ code: null, signal: null, stdout: "", stderr: error.message }));
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ code: null, signal: "timeout", stdout, stderr: `${stderr}\nTimed out after ${options.timeoutMs || defaultTimeoutMs} ms` });
    }, options.timeoutMs || defaultTimeoutMs);

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
      resolve({ code: null, signal: null, stdout, stderr: error.message });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function redact(text) {
  return String(text).replace(/tkn=[A-Za-z0-9._~-]+/g, "tkn=<redacted>");
}

async function ensureToken() {
  await mkdir(stateDir, { recursive: true });
  if (!existsSync(tokenPath)) {
    await writeFile(tokenPath, randomBytes(32).toString("hex"), { encoding: "utf8", flag: "wx" });
  }
  return (await readFile(tokenPath, "utf8")).trim();
}

async function readHostAddress() {
  if (!existsSync(hostLogPath)) return "";
  const log = (await readFile(hostLogPath, "utf8")).replace(/\u001b\[[0-9;]*m/g, "");
  const match = log.match(/ws:\/\/(?:localhost|127\.0\.0\.1):\d+\?tkn=[A-Za-z0-9._~-]+/);
  return match ? match[0].trim().replace("ws://localhost:", "ws://127.0.0.1:") : "";
}

async function status() {
  const code = codeCommand();
  const version = await run(code, ["--version"], { timeoutMs: 15000 });
  const agentHelp = await run(code, ["agent", "--help"], { timeoutMs: 15000 });
  const hostHelp = await run(code, ["agent", "host", "--help"], { timeoutMs: 15000 });
  console.log(JSON.stringify({
    codeCommand: code,
    codeVersionOk: version.code === 0,
    codeVersion: version.stdout.trim().split(/\r?\n/),
    agentCliOk: agentHelp.code === 0,
    hostCliOk: hostHelp.code === 0,
    tokenFile: tokenPath,
    notes: [
      "AHP is experimental and should stay behind smoke checks.",
      "Use ps before assuming any agent host is running.",
    ],
  }, null, 2));
}

async function ps() {
  let result = await run(codeCommand(), ["agent", "ps", "--json"], { timeoutMs: defaultTimeoutMs });
  let usedAddressFromLog = false;
  if (result.code !== 0 || /No running agent host found/i.test(`${result.stdout}\n${result.stderr}`)) {
    const address = await readHostAddress();
    if (address) {
      usedAddressFromLog = true;
      result = await run(codeCommand(), ["agent", "ps", "--json", "--address", address], { timeoutMs: defaultTimeoutMs });
    }
  }
  if (result.stdout.trim()) {
    try {
      const parsed = JSON.parse(result.stdout);
      console.log(JSON.stringify({ usedAddressFromLog, sessions: parsed }, null, 2));
    } catch {
      console.log(redact(result.stdout));
    }
  }
  if (result.stderr.trim()) console.error(redact(result.stderr.trim()));
  process.exitCode = result.code === 0 ? 0 : 1;
}

async function wsSmoke() {
  const address = await readHostAddress();
  if (!address) {
    console.log(JSON.stringify({ hasAddress: false, opened: false }, null, 2));
    process.exitCode = 1;
    return;
  }
  const redactedAddress = address.replace(/tkn=.*/, "tkn=<redacted>");
  const result = await new Promise((resolve) => {
    const socket = new WebSocket(address);
    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {}
      resolve({ hasAddress: true, address: redactedAddress, opened: false, timeout: true });
    }, 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      socket.close();
      resolve({ hasAddress: true, address: redactedAddress, opened: true });
    });
    socket.addEventListener("error", (event) => {
      clearTimeout(timer);
      resolve({
        hasAddress: true,
        address: redactedAddress,
        opened: false,
        error: String(event?.message || event?.error || "websocket-error"),
      });
    });
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.opened ? 0 : 1;
}

function rpc(socket, method, params, id) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ id, timeout: true }), 10000);
    const onMessage = (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  });
}

async function rpcSmoke() {
  const address = await readHostAddress();
  if (!address) {
    console.log(JSON.stringify({ hasAddress: false, ok: false }, null, 2));
    process.exitCode = 1;
    return;
  }

  const redactedAddress = address.replace(/tkn=.*/, "tkn=<redacted>");
  const socket = new WebSocket(address);
  const opened = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(true);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });

  if (!opened) {
    console.log(JSON.stringify({ address: redactedAddress, opened: false, ok: false }, null, 2));
    process.exitCode = 1;
    return;
  }

  const init = await rpc(socket, "initialize", {
    channel: "ahp-root://",
    protocolVersions: ["0.5.0", "0.4.0", "0.3.0", "0.2.0", "0.1.0"],
    clientId: "theseus-ahp-probe",
    initialSubscriptions: ["ahp-root://"],
    locale: "ru-RU",
    capabilities: {},
  }, 1);

  let sessions = null;
  if (!init.error && !init.timeout) {
    sessions = await rpc(socket, "listSessions", { channel: "ahp-root://", limit: 20 }, 2);
  }

  socket.close();
  const ok = Boolean(!init.error && !init.timeout && sessions && !sessions.error && !sessions.timeout);
  console.log(JSON.stringify({
    address: redactedAddress,
    opened: true,
    initialize: summarizeRpc(init),
    listSessions: sessions ? summarizeRpc(sessions) : null,
    ok,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
}

function summarizeRpc(message) {
  if (!message) return null;
  if (message.timeout) return { timeout: true };
  if (message.error) {
    return {
      error: {
        code: message.error.code,
        message: redact(message.error.message || ""),
      },
    };
  }
  if (message.result?.protocolVersion) {
    const rootSnapshot = (message.result.snapshots || []).find((snapshot) => snapshot.resource === "ahp-root://");
    const rootState = rootSnapshot?.state || {};
    return {
      hasResult: true,
      protocolVersion: message.result.protocolVersion,
      serverSeq: message.result.serverSeq,
      defaultDirectory: message.result.defaultDirectory,
      agents: (rootState.agents || []).map((agent) => ({
        provider: agent.provider,
        displayName: agent.displayName,
        protectedResourceCount: (agent.protectedResources || []).length,
      })),
      activeSessions: rootState.activeSessions,
      configKeys: rootState.config?.values ? Object.keys(rootState.config.values) : [],
    };
  }
  if (Array.isArray(message.result?.items)) {
    return {
      hasResult: true,
      itemCount: message.result.items.length,
      items: message.result.items,
      nextCursor: message.result.nextCursor,
    };
  }
  return {
    hasResult: Object.hasOwn(message, "result"),
    resultKeys: message.result && typeof message.result === "object" ? Object.keys(message.result) : [],
    result: message.result,
  };
}

async function host({ replace = false } = {}) {
  await ensureToken();
  console.error(`Starting VS Code agent host on 127.0.0.1 with token file: ${tokenPath}`);
  console.error(`Host log: ${hostLogPath}`);
  await writeFile(hostLogPath, `# VS Code AHP host log\nstarted=${new Date().toISOString()}\n`, { encoding: "utf8" });
  const args = [
    "agent",
    "host",
    "--host",
    "127.0.0.1",
    "--port",
    "0",
    "--connection-token-file",
    tokenPath,
  ];
  if (replace) args.push("--replace");
  const result = await run(codeCommand(), args, { stdoutFile: hostLogPath });
  process.exitCode = result.code === 0 ? 0 : 1;
}

async function logs(session) {
  if (!session) {
    throw new Error("Usage: ahp_probe.mjs logs <session-uri>");
  }
  if (!/^[a-z][a-z0-9+.-]*:\/[^\s"']+$/i.test(session)) {
    throw new Error("Session URI contains unsupported characters");
  }
  const result = await run(codeCommand(), ["agent", "logs", session], { inherit: true });
  process.exitCode = result.code === 0 ? 0 : 1;
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === "status") await status();
  else if (mode === "ps") await ps();
  else if (mode === "ws-smoke") await wsSmoke();
  else if (mode === "rpc-smoke") await rpcSmoke();
  else if (mode === "host") await host();
  else if (mode === "host-replace") await host({ replace: true });
  else if (mode === "logs") await logs(rest[0]);
  else throw new Error("Usage: ahp_probe.mjs status | ps | ws-smoke | rpc-smoke | host | host-replace | logs <session-uri>");
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
}
