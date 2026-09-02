export const DEFAULT_MODEL = "upstage/solar-pro4:free";
export const DEFAULT_DIRECT_BASE_URL = "https://inference-api.nousresearch.com/v1";
export const DEFAULT_PROXY_BASE_URL = "http://hermes-proxy:8645/v1";
export const MIN_MAX_TOKENS = 200;

export function buildCompletionPayload(model = DEFAULT_MODEL) {
  if (!String(model).trim()) throw new Error("model is required");
  return {
    model,
    messages: [{ role: "user", content: "Reply exactly: route-ok" }],
    max_tokens: 256,
    stream: false,
  };
}

function normalizedStatus(value) {
  if (value === null || value === undefined || value === "") return null;
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function normalizedLatency(value) {
  const latency = Number(value);
  return Number.isFinite(latency) && latency >= 0 ? Math.round(latency) : 0;
}

function baseResult({ target = "direct", client_stack = "unknown", model = DEFAULT_MODEL, http_status, latency_ms }) {
  return {
    target,
    client_stack,
    stage: "chat_completion",
    model,
    http_status: normalizedStatus(http_status),
    latency_ms: normalizedLatency(latency_ms),
  };
}

function providerErrorClass(error, status) {
  const code = String(error?.code ?? error?.status ?? status ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  if (code.includes("502") || message.includes("overload") || message.includes("upstream")) return "upstream_502";
  if (code.includes("429") || message.includes("rate")) return "rate_limited";
  if (code.includes("404") || message.includes("model") || message.includes("not found")) return "model_not_found";
  if (code.includes("401") || message.includes("unauthorized") || message.includes("authentication")) return "unauthorized";
  return "provider_error";
}

function transportErrorClass(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("econnrefused")) return "connection_refused";
  if (text.includes("enotfound") || text.includes("dns")) return "dns_failure";
  if (text.includes("econnreset")) return "connection_reset";
  return "transport_error";
}

function isCloudflare1010(status, responseText) {
  const text = String(responseText || "").toLowerCase();
  return status === 403 && /\b1010\b/.test(text) && (text.includes("cloudflare") || text.includes("error code"));
}

export function classifyCompletion({
  target = "direct",
  client_stack = "unknown",
  model = DEFAULT_MODEL,
  http_status,
  response_text = "",
  latency_ms,
  timed_out = false,
  transport_error = "",
} = {}) {
  const status = normalizedStatus(http_status);
  const result = baseResult({ target, client_stack, model, http_status: status, latency_ms });
  const responseText = String(response_text || "");

  if (timed_out) {
    return { ...result, classification: "TIMEOUT", error_class: "timeout", content_nonempty: false };
  }

  if (transport_error) {
    return {
      ...result,
      classification: target === "proxy" ? "PROXY_UNREACHABLE" : "NETWORK_UNREACHABLE",
      error_class: transportErrorClass(transport_error),
      content_nonempty: false,
    };
  }

  if (status === 401) return { ...result, classification: "AUTH_FAILURE", error_class: "unauthorized", content_nonempty: false };
  if (isCloudflare1010(status, responseText)) {
    return {
      ...result,
      classification: "CLIENT_TLS_FINGERPRINT_BLOCK",
      error_class: "cloudflare_1010",
      content_nonempty: false,
    };
  }
  if (status === 403) return { ...result, classification: "AUTH_FAILURE", error_class: "forbidden", content_nonempty: false };
  if (status === 404) return { ...result, classification: "MODEL_NOT_FOUND", error_class: "model_not_found", content_nonempty: false };
  if (status === 429) return { ...result, classification: "RATE_LIMITED", error_class: "rate_limited", content_nonempty: false };
  if ([502, 503, 504].includes(status)) {
    return { ...result, classification: "UPSTREAM_OVERLOAD", error_class: `upstream_${status}`, content_nonempty: false };
  }
  if (status !== null && (status < 200 || status >= 300)) {
    return { ...result, classification: "HTTP_ERROR", error_class: `http_${status}`, content_nonempty: false };
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return { ...result, classification: "MALFORMED_RESPONSE", error_class: "malformed_json", content_nonempty: false };
  }

  if (parsed?.error) {
    return {
      ...result,
      classification: "WRAPPED_PROVIDER_ERROR",
      error_class: providerErrorClass(parsed.error, status),
      content_nonempty: false,
    };
  }

  const choice = parsed?.choices?.[0];
  if (!choice) return { ...result, classification: "MALFORMED_RESPONSE", error_class: "missing_choices", content_nonempty: false };

  const content = choice?.message?.content;
  const contentNonempty = typeof content === "string" && content.trim().length > 0;
  if (!contentNonempty) return { ...result, classification: "EMPTY_CONTENT", content_nonempty: false };

  const finishReason = choice?.finish_reason;
  if (!finishReason) return { ...result, classification: "INCOMPLETE_RESPONSE", content_nonempty: true };

  if (status !== null && status >= 200 && status < 300) {
    return {
      ...result,
      classification: "SUCCESS",
      finish_reason: finishReason,
      content_nonempty: true,
    };
  }

  return { ...result, classification: "HTTP_ERROR", error_class: "missing_http_status", content_nonempty: true };
}
