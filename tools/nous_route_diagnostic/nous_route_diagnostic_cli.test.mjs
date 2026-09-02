import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDirectCurlInvocation,
  buildPythonInvocation,
  buildConfigMissingResult,
  parseProbeOutput,
} from "./nous_route_diagnostic_cli.mjs";

const model = "upstage/solar-pro4:free";
const endpoint = "https://inference-api.nousresearch.com/v1/chat/completions";
const payload = {
  model,
  messages: [{ role: "user", content: "Reply exactly: route-ok" }],
  max_tokens: 256,
  stream: false,
};

test("builds explicit curl.exe invocation without placing bearer in args", () => {
  const invocation = buildDirectCurlInvocation({ endpoint, payload, bearer: "fixture-token" });

  assert.equal(invocation.command, "curl.exe");
  assert.match(invocation.input, /^Authorization: Bearer fixture-token\n$/);
  assert.doesNotMatch(JSON.stringify({ command: invocation.command, args: invocation.args }), /fixture-token/);
  assert.ok(invocation.args.includes("@-"));
  assert.ok(invocation.args.includes(JSON.stringify(payload)));
});

test("builds Python negative-control invocation with a labelled client stack", () => {
  const invocation = buildPythonInvocation({ endpoint, payload, bearer: "fixture-token" });

  assert.equal(invocation.command, "python");
  assert.equal(invocation.client_stack, "python-urllib");
  assert.match(invocation.args[1], /payload = json\.loads\(/);
  assert.match(invocation.input, /^Authorization: Bearer fixture-token\n$/);
  assert.doesNotMatch(JSON.stringify({ command: invocation.command, args: invocation.args }), /fixture-token/);
});

test("parses a status marker and forwards only safe fields to the classifier", () => {
  const result = parseProbeOutput({
    target: "direct",
    client_stack: "curl.exe-schannel",
    model,
    stdout: `${JSON.stringify({ id: "private-id", choices: [{ message: { content: "route-ok" }, finish_reason: "stop" }] })}\n__THESEUS_HTTP_STATUS__:200`,
    stderr: "",
    code: 0,
    timed_out: false,
    latency_ms: 45,
  });

  assert.equal(result.classification, "SUCCESS");
  assert.equal(result.http_status, 200);
  assert.equal(result.latency_ms, 45);
  assert.doesNotMatch(JSON.stringify(result), /private-id|route-ok/);
});

test("turns an unmarked process failure into a safe transport classification", () => {
  const result = parseProbeOutput({
    target: "proxy",
    client_stack: "python-proxy-internal",
    model,
    stdout: "",
    stderr: "connect ECONNREFUSED hermes-proxy:8645",
    code: 1,
    timed_out: false,
    latency_ms: 19,
  });

  assert.equal(result.classification, "PROXY_UNREACHABLE");
  assert.equal(result.error_class, "connection_refused");
  assert.doesNotMatch(JSON.stringify(result), /hermes-proxy/);
});

test("reports missing bearer configuration without making a network claim", () => {
  const result = buildConfigMissingResult({ target: "direct", client_stack: "curl.exe-schannel", model, variable: "NOUS_AGENT_KEY" });

  assert.deepEqual(result, {
    target: "direct",
    client_stack: "curl.exe-schannel",
    stage: "chat_completion",
    model,
    http_status: null,
    classification: "CONFIG_MISSING",
    error_class: "missing_bearer_env",
    content_nonempty: false,
    latency_ms: 0,
  });
  assert.doesNotMatch(JSON.stringify(result), /NOUS_AGENT_KEY/);
});
