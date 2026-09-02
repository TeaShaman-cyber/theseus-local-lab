#!/usr/bin/env node

import { spawnWithTimeout } from "../memory_outbox/provider-timeout.mjs";
import {
  DEFAULT_DIRECT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROXY_BASE_URL,
  buildCompletionPayload,
  classifyCompletion,
} from "./nous_route_diagnostic.mjs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_COMPOSE_FILE = resolve(REPO_ROOT, "deploy/hindsight/docker-compose.yml");
const STATUS_MARKER = "__THESEUS_HTTP_STATUS__:";
const TRANSPORT_MARKER = "__THESEUS_TRANSPORT__:";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

function normalizeTimeout(value) {
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
    throw new Error("invalid timeout");
  }
  return timeout;
}

function parseArgs(argv) {
  const result = {
    target: "direct",
    model: process.env.NOUS_MODEL || DEFAULT_MODEL,
    base_url: "",
    token_env: "NOUS_AGENT_KEY",
    timeout_ms: DEFAULT_TIMEOUT_MS,
    compose_project: "hindsight-cloud",
    compose_file: DEFAULT_COMPOSE_FILE,
    compose_service: "hindsight",
    dry_run: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const value = () => argv[++index] || "";
    if (item === "--target") result.target = value();
    else if (item === "--model") result.model = value();
    else if (item === "--base-url") result.base_url = value();
    else if (item === "--token-env") result.token_env = value();
    else if (item === "--timeout-ms") result.timeout_ms = normalizeTimeout(value());
    else if (item === "--compose-project") result.compose_project = value();
    else if (item === "--compose-file") result.compose_file = resolve(REPO_ROOT, value());
    else if (item === "--compose-service") result.compose_service = value();
    else if (item === "--dry-run") result.dry_run = true;
    else throw new Error("unknown argument");
  }

  if (!["direct", "direct-python", "proxy"].includes(result.target)) throw new Error("invalid target");
  if (!String(result.model).trim()) throw new Error("model is required");
  return result;
}

function completionEndpoint(baseUrl) {
  const parsed = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("unsafe base URL");
  }
  return `${parsed.toString().replace(/\/$/, "")}/chat/completions`;
}

function baseSafeResult({ target, client_stack, model }) {
  return {
    target,
    client_stack,
    stage: "chat_completion",
    model,
    http_status: null,
    content_nonempty: false,
    latency_ms: 0,
  };
}

export function buildConfigMissingResult({ target, client_stack, model }) {
  return {
    ...baseSafeResult({ target, client_stack, model }),
    classification: "CONFIG_MISSING",
    error_class: "missing_bearer_env",
  };
}

export function buildDirectCurlInvocation({ endpoint, payload, bearer, timeout_ms = DEFAULT_TIMEOUT_MS }) {
  return {
    command: "curl.exe",
    args: [
      "--silent",
      "--show-error",
      "--location",
      "--request",
      "POST",
      "--connect-timeout",
      String(Math.ceil(timeout_ms / 1000)),
      "--max-time",
      String(Math.ceil(timeout_ms / 1000)),
      "--header",
      "@-",
      "--header",
      "content-type: application/json",
      "--data-raw",
      JSON.stringify(payload),
      "--write-out",
      `\\n${STATUS_MARKER}%{http_code}`,
      endpoint,
    ],
    input: `Authorization: Bearer ${bearer}\n`,
    client_stack: "curl.exe-schannel",
  };
}

function buildPythonScript({ endpoint, payload, bearer_from_stdin = true, bearer = "" }) {
  return [
    "import json, sys, time, urllib.error, urllib.request",
    `endpoint = ${JSON.stringify(endpoint)}`,
    `payload = json.loads(${JSON.stringify(JSON.stringify(payload))})`,
    `authorization = sys.stdin.read().strip() if ${bearer_from_stdin ? "True" : "False"} else ${JSON.stringify(`Bearer ${bearer}`)}`,
    "request = urllib.request.Request(endpoint, data=json.dumps(payload).encode(), headers={\"Authorization\": authorization, \"Content-Type\": \"application/json\"}, method=\"POST\")",
    "try:",
    "    with urllib.request.urlopen(request, timeout=90) as response:",
    "        sys.stdout.buffer.write(response.read())",
    "        sys.stdout.write(\"\\n__THESEUS_HTTP_STATUS__:\" + str(response.status))",
    "except urllib.error.HTTPError as error:",
    "    sys.stdout.buffer.write(error.read())",
    "    sys.stdout.write(\"\\n__THESEUS_HTTP_STATUS__:\" + str(error.code))",
    "except Exception as error:",
    "    sys.stdout.write(\"__THESEUS_TRANSPORT__:\" + type(error).__name__)",
  ].join("\n");
}

export function buildPythonInvocation({ endpoint, payload, bearer, timeout_ms = DEFAULT_TIMEOUT_MS }) {
  return {
    command: "python",
    args: ["-c", buildPythonScript({ endpoint, payload })],
    input: `Authorization: Bearer ${bearer}\n`,
    client_stack: "python-urllib",
    timeout_ms,
  };
}

export function buildProxyInvocation({ endpoint, payload, compose_project, compose_file, compose_service }) {
  return {
    command: "docker",
    args: [
      "compose",
      "--project-name",
      compose_project,
      "-f",
      compose_file,
      "exec",
      "-T",
      compose_service,
      "python3",
      "-",
    ],
    input: buildPythonScript({ endpoint, payload, bearer_from_stdin: false, bearer: "hermes-proxy-local" }),
    client_stack: "python-proxy-internal",
  };
}

function markerMatch(stdout, marker) {
  const pattern = new RegExp(`\\n?${marker.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}(\\d{3})\\s*$`);
  return stdout.match(pattern);
}

export function parseProbeOutput({ target, client_stack, model, stdout = "", stderr = "", code = null, timed_out = false, latency_ms = 0 }) {
  const status = markerMatch(stdout, STATUS_MARKER);
  const transport = stdout.match(new RegExp(`${TRANSPORT_MARKER}([A-Za-z0-9_]+)`));
  let responseText = stdout;
  let http_status = null;
  let transport_error = "";

  if (status) {
    http_status = Number(status[1]);
    responseText = stdout.slice(0, status.index).replace(/\r?\n$/, "");
  } else if (transport) {
    responseText = "";
    transport_error = transport[1];
  } else if (!timed_out && code !== 0) {
    responseText = "";
    transport_error = stderr || "process_exit";
  }

  return classifyCompletion({
    target,
    client_stack,
    model,
    http_status,
    response_text: responseText,
    timed_out,
    transport_error,
    latency_ms,
  });
}

function addObservedMetadata(result) {
  return {
    ...result,
    memory_write: false,
    evidence_refs: [],
    observed_at: new Date().toISOString(),
  };
}

function dryRunResult({ target, client_stack, model }) {
  return addObservedMetadata({
    ...baseSafeResult({ target, client_stack, model }),
    classification: "DRY_RUN",
  });
}

async function executeInvocation({ invocation, target, model, timeout_ms }) {
  const started = performance.now();
  const processResult = await spawnWithTimeout(
    invocation.command,
    invocation.args,
    {
      cwd: REPO_ROOT,
      windowsHide: true,
      shell: false,
      input: invocation.input,
    },
    timeout_ms,
  );
  const latency_ms = Math.round(performance.now() - started);
  return parseProbeOutput({
    target,
    client_stack: invocation.client_stack,
    model,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
    code: processResult.code,
    timed_out: processResult.timedOut,
    latency_ms,
  });
}

async function runTarget(options) {
  const { target, model, timeout_ms } = options;
  const client_stack = target === "direct" ? "curl.exe-schannel" : target === "direct-python" ? "python-urllib" : "python-proxy-internal";

  if (options.dry_run) return dryRunResult({ target, client_stack, model });
  if (target !== "proxy" && process.platform !== "win32") {
    return addObservedMetadata({
      ...baseSafeResult({ target, client_stack, model }),
      classification: "CONFIG_MISSING",
      error_class: "windows_curl_required",
    });
  }

  const baseUrl = options.base_url || (target === "proxy" ? DEFAULT_PROXY_BASE_URL : DEFAULT_DIRECT_BASE_URL);
  const endpoint = completionEndpoint(baseUrl);
  const payload = buildCompletionPayload(model);

  if (target !== "proxy") {
    const bearer = process.env[options.token_env];
    if (!bearer) return addObservedMetadata(buildConfigMissingResult({ target, client_stack, model }));
    const invocation = target === "direct"
      ? buildDirectCurlInvocation({ endpoint, payload, bearer, timeout_ms })
      : buildPythonInvocation({ endpoint, payload, bearer, timeout_ms });
    return addObservedMetadata(await executeInvocation({ invocation, target, model, timeout_ms }));
  }

  const invocation = buildProxyInvocation({
    endpoint,
    payload,
    compose_project: options.compose_project,
    compose_file: options.compose_file,
    compose_service: options.compose_service,
  });
  return addObservedMetadata(await executeInvocation({ invocation, target, model, timeout_ms }));
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const result = await runTarget(options);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = ["SUCCESS", "DRY_RUN"].includes(result.classification) ? 0 : result.classification === "CONFIG_MISSING" ? 2 : 1;
  } catch {
    console.log(JSON.stringify({ classification: "CLI_ERROR", error_class: "invalid_arguments" }, null, 2));
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
