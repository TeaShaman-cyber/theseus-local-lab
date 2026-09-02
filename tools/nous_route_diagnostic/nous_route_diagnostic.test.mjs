import assert from "node:assert/strict";
import test from "node:test";

import { buildCompletionPayload, classifyCompletion } from "./nous_route_diagnostic.mjs";

const model = "upstage/solar-pro4:free";

function classify(overrides = {}) {
  return classifyCompletion({
    target: "direct",
    client_stack: "curl.exe-schannel",
    model,
    latency_ms: 123,
    ...overrides,
  });
}

test("builds a bounded fixed completion payload", () => {
  assert.deepEqual(buildCompletionPayload(model), {
    model,
    messages: [{ role: "user", content: "Reply exactly: route-ok" }],
    max_tokens: 256,
    stream: false,
  });
});

test("classifies a successful completion without returning the raw body", () => {
  const result = classify({
    http_status: 200,
    response_text: JSON.stringify({
      id: "chatcmpl-private-id",
      choices: [{ message: { role: "assistant", content: "route-ok" }, finish_reason: "stop" }],
    }),
  });

  assert.deepEqual(result, {
    target: "direct",
    client_stack: "curl.exe-schannel",
    stage: "chat_completion",
    model,
    http_status: 200,
    classification: "SUCCESS",
    finish_reason: "stop",
    content_nonempty: true,
    latency_ms: 123,
  });
  assert.doesNotMatch(JSON.stringify(result), /chatcmpl-private-id|route-ok/);
});

test("classifies HTTP 401 as an authentication failure", () => {
  const result = classify({ http_status: 401, response_text: '{"error":{"message":"credentials omitted"}}' });
  assert.equal(result.classification, "AUTH_FAILURE");
  assert.equal(result.error_class, "unauthorized");
});

test("classifies Cloudflare 1010 as a client TLS fingerprint block", () => {
  const result = classify({
    http_status: 403,
    response_text: "<html>Cloudflare error code: 1010</html>",
  });
  assert.equal(result.classification, "CLIENT_TLS_FINGERPRINT_BLOCK");
  assert.equal(result.error_class, "cloudflare_1010");
});

test("classifies HTTP 404 as model not found", () => {
  const result = classify({ http_status: 404, response_text: '{"error":{"code":404}}' });
  assert.equal(result.classification, "MODEL_NOT_FOUND");
  assert.equal(result.error_class, "model_not_found");
});

test("classifies HTTP 429 as rate limited", () => {
  const result = classify({ http_status: 429, response_text: '{"error":{"code":429}}' });
  assert.equal(result.classification, "RATE_LIMITED");
  assert.equal(result.error_class, "rate_limited");
});

test("classifies HTTP 502 as upstream overload", () => {
  const result = classify({ http_status: 502, response_text: '{"error":{"code":502}}' });
  assert.equal(result.classification, "UPSTREAM_OVERLOAD");
  assert.equal(result.error_class, "upstream_502");
});

test("does not accept a wrapped HTTP-200 provider error as success", () => {
  const result = classify({
    http_status: 200,
    response_text: '{"error":{"code":502,"message":"upstream unavailable"}}',
  });
  assert.equal(result.classification, "WRAPPED_PROVIDER_ERROR");
  assert.equal(result.error_class, "upstream_502");
  assert.equal(result.content_nonempty, false);
});

test("classifies a bounded process timeout without a status", () => {
  const result = classify({ timed_out: true, response_text: "" });
  assert.equal(result.classification, "TIMEOUT");
  assert.equal(result.error_class, "timeout");
  assert.equal(result.http_status, null);
});

test("classifies a proxy connection failure separately from provider auth", () => {
  const result = classify({
    target: "proxy",
    client_stack: "python-proxy-internal",
    http_status: null,
    response_text: "",
    transport_error: "ECONNREFUSED hermes-proxy:8645",
  });
  assert.equal(result.classification, "PROXY_UNREACHABLE");
  assert.equal(result.error_class, "connection_refused");
});

test("classifies malformed JSON without exposing the response", () => {
  const result = classify({ http_status: 200, response_text: "not-json" });
  assert.equal(result.classification, "MALFORMED_RESPONSE");
  assert.equal(result.error_class, "malformed_json");
  assert.doesNotMatch(JSON.stringify(result), /not-json/);
});

test("classifies an empty assistant content as incomplete", () => {
  const result = classify({
    http_status: 200,
    response_text: JSON.stringify({ choices: [{ message: { content: null }, finish_reason: "stop" }] }),
  });
  assert.equal(result.classification, "EMPTY_CONTENT");
  assert.equal(result.content_nonempty, false);
});

test("classifies a response without finish reason as incomplete", () => {
  const result = classify({
    http_status: 200,
    response_text: JSON.stringify({ choices: [{ message: { content: "present" } }] }),
  });
  assert.equal(result.classification, "INCOMPLETE_RESPONSE");
  assert.equal(result.content_nonempty, true);
});
