#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { writeTimelineEvent } from "../session_timeline/event_writer.mjs";
import { buildProbeInvocation } from "./backends.mjs";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_DIAGNOSTIC_CHARS,
  makeResult,
  validateRequest,
} from "./contract.mjs";

const CAPTURE_LIMIT = MAX_DIAGNOSTIC_CHARS + 1;

function appendBounded(current, chunk) {
  if (current.length >= CAPTURE_LIMIT) return current;
  return `${current}${String(chunk ?? "")}`.slice(0, CAPTURE_LIMIT);
}

function backendOptions(request) {
  if (request.backend === "wsl") {
    return {
      distro: request.distro || process.env.THESEUS_WSL_DISTRO || "Ubuntu-24.04",
      cwd: request.cwd || request.workspace || process.env.THESEUS_WSL_CWD || "~",
    };
  }
  if (request.backend === "ubuntu-vm") {
    return { host: request.host || process.env.THESEUS_VM_HOST || "theseus-ubuntu-vm" };
  }
  if (request.backend === "codex-do") {
    return {
      host: request.host || process.env.THESEUS_CODEX_DO_HOST || "138.68.66.30",
      user: request.user || process.env.THESEUS_CODEX_DO_USER || "root",
    };
  }
  return {};
}

function postcondition(backend, stdout, exitCode) {
  if (exitCode !== 0) {
    return { passed: false, checks: ["process_exit_zero"] };
  }

  const text = String(stdout || "");
  if (backend === "codex-do") {
    const checks = [
      [text.includes("runtime=codex-do"), "runtime_identified", "runtime_missing"],
      [text.includes("physical_scope=remote-do"), "physical_scope_identified", "physical_scope_missing"],
      [text.includes("project_scope=family-research"), "project_scope_identified", "project_scope_missing"],
      [text.includes("workspace_present=true"), "workspace_present", "workspace_missing"],
      [text.includes("git_root=/root/workspaces/family-research-lab"), "git_root_identified", "git_root_missing"],
      [text.includes("remote_host="), "remote_host_identified", "remote_host_missing"],
      [text.includes("remote_user=root"), "remote_user_identified", "remote_user_missing"],
    ];
    return {
      passed: checks.every(([passed]) => passed),
      checks: checks.map(([, passed, failed]) => passed ? passed : failed),
    };
  }
  if (backend === "docker") {
    const passed = text.trim().length > 0;
    return {
      passed,
      checks: ["docker_version_present"],
    };
  }

  const runtimeMarker = `runtime=${backend}`;
  const runtimeIdentified = text.includes(runtimeMarker);
  const toolChecked = /\b(?:node|git)\b/.test(text);
  return {
    passed: runtimeIdentified && toolChecked,
    checks: [
      runtimeIdentified ? "runtime_identified" : "runtime_missing",
      toolChecked ? "expected_tool_checked" : "expected_tool_missing",
    ],
  };
}

function statusForExit(backend, exitCode, stderr) {
  if (exitCode === 0) return "OK";
  if (["ubuntu-vm", "codex-do"].includes(backend) && /permission denied|publickey|authentication failed/i.test(stderr)) {
    return "PERMISSION_DENIED";
  }
  if (["ubuntu-vm", "codex-do"].includes(backend) && (exitCode === 255 || /connection timed out|connection refused|no route to host|could not resolve/i.test(stderr))) {
    return "UNAVAILABLE";
  }
  return "UNKNOWN";
}

export function parseArgs(argv) {
  const args = {
    command: "",
    backend: "",
    timeout_ms: undefined,
    distro: undefined,
    cwd: undefined,
    host: undefined,
    user: undefined,
    no_log: false,
  };

  const valueOptions = new Map([
    ["--backend", "backend"],
    ["--timeout-ms", "timeout_ms"],
    ["--distro", "distro"],
    ["--cwd", "cwd"],
    ["--host", "host"],
    ["--user", "user"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      if (args.command) throw new Error(`unexpected argument: ${item}`);
      args.command = item;
      continue;
    }
    if (item === "--no-log") {
      args.no_log = true;
      continue;
    }

    const field = valueOptions.get(item);
    if (!field) throw new Error(`unknown option: ${item}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${item} requires a value`);
    }
    args[field] = field === "timeout_ms" ? Number(value) : value;
    index += 1;
  }

  return args;
}

export async function runProbe(input, dependencies = {}) {
  const validation = validateRequest(input);
  if (!validation.ok) {
    return makeResult({
      backend: typeof input?.backend === "string" ? input.backend : "",
      status: "INVALID_REQUEST",
      exit_code: 2,
      stderr: validation.errors.join("; "),
      fallback_used: false,
      postcondition: { passed: false, checks: ["request_valid"] },
    });
  }

  const request = { ...validation.request, ...input };
  const timeoutMs = request.timeout_ms || DEFAULT_TIMEOUT_MS;
  let invocation;
  try {
    invocation = buildProbeInvocation(request.backend, backendOptions(request));
  } catch (error) {
    return makeResult({
      backend: request.backend,
      status: "INVALID_REQUEST",
      exit_code: 2,
      stderr: error?.message || error,
      fallback_used: false,
      postcondition: { passed: false, checks: ["backend_options_valid"] },
    });
  }

  const spawnProcess = dependencies.spawn || spawn;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let child;
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fields, kill = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = makeResult({
        backend: request.backend,
        elapsed_ms: Date.now() - startedAt,
        fallback_used: false,
        stdout,
        stderr,
        ...fields,
      });
      resolve(result);
      if (kill && child && typeof child.kill === "function") {
        try {
          child.kill("SIGTERM");
        } catch {
          // The process may have exited between the timeout and kill call.
        }
      }
    };

    const timer = setTimeout(() => {
      finish({
        status: "TIMEOUT",
        signal: "SIGTERM",
        postcondition: { passed: false, checks: ["completed_before_timeout"] },
      }, true);
    }, timeoutMs);

    try {
      child = spawnProcess(invocation.command, invocation.args, {
        cwd: invocation.cwd,
        env: invocation.env || process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      finish({
        status: "UNAVAILABLE",
        exit_code: -1,
        error: error?.message || error,
        postcondition: { passed: false, checks: ["process_started"] },
      });
      return;
    }

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", (error) => {
      finish({
        status: "UNAVAILABLE",
        exit_code: -1,
        error: error?.message || error,
        postcondition: { passed: false, checks: ["process_started"] },
      });
    });
    child.on("close", (exitCode, signal) => {
      const check = exitCode === 0
        ? postcondition(request.backend, stdout, exitCode)
        : { passed: false, checks: ["process_exit_zero"] };
      const exitStatus = statusForExit(request.backend, exitCode, stderr);
      finish({
        status: exitStatus === "OK" ? (check.passed ? "OK" : "UNKNOWN") : exitStatus,
        exit_code: Number.isInteger(exitCode) ? exitCode : null,
        signal: signal || null,
        postcondition: check,
      });
    });
  });
}

async function writeProbeLog(result) {
  await writeTimelineEvent({
    source: "unix-runtime",
    event: "backend-probe",
    note: `${result.backend} probe: ${result.status}`,
    tag: "unix-runtime",
    metrics: {
      status: result.status,
      elapsed_ms: result.elapsed_ms,
      postcondition_passed: result.postcondition.passed,
      fallback_used: result.fallback_used,
    },
  });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.command !== "probe") throw new Error("Usage: unix_runtime.mjs probe --backend <id>");
  if (!args.backend) throw new Error("--backend is required");

  const request = {
    backend: args.backend,
    task: "probe",
    ...(args.timeout_ms === undefined ? {} : { timeout_ms: args.timeout_ms }),
    ...(args.distro === undefined ? {} : { distro: args.distro }),
    ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
    ...(args.host === undefined ? {} : { host: args.host }),
    ...(args.user === undefined ? {} : { user: args.user }),
  };
  const result = await runProbe(request);
  if (!args.no_log) await writeProbeLog(result);
  console.log(JSON.stringify(result));
  return result.status === "OK" ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 2;
  }
}
