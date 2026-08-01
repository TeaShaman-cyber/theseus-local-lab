export const BACKENDS = new Set(["wsl", "docker", "ubuntu-vm"]);
export const MODES = new Set(["read-only", "scoped-write"]);
export const STATUSES = new Set([
  "OK",
  "UNAVAILABLE",
  "TIMEOUT",
  "PERMISSION_DENIED",
  "INVALID_REQUEST",
  "UNKNOWN",
]);

export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_TIMEOUT_MS = 120_000;
export const MAX_DIAGNOSTIC_CHARS = 4_000;
export const MAX_FIELD_CHARS = 512;

const truncate = (value, limit = MAX_DIAGNOSTIC_CHARS) => {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (text.length <= limit) return text;
  const marker = "…[truncated]";
  return `${text.slice(0, Math.max(0, limit - marker.length))}${marker}`;
};

const trimField = (value, field, errors) => {
  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) errors.push(`${field} must not be empty`);
  if (trimmed.length > MAX_FIELD_CHARS) errors.push(`${field} is too long`);
  return trimmed;
};

export function validateRequest(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["request must be an object"], request: undefined };
  }

  const backend = trimField(input.backend, "backend", errors);
  const task = trimField(input.task, "task", errors);
  const mode = input.mode === undefined
    ? "read-only"
    : trimField(input.mode, "mode", errors);
  const workspace = input.workspace === undefined
    ? undefined
    : trimField(input.workspace, "workspace", errors);

  const timeout_ms = input.timeout_ms === undefined
    ? DEFAULT_TIMEOUT_MS
    : input.timeout_ms;
  if (!Number.isInteger(timeout_ms) || timeout_ms <= 0 || timeout_ms > MAX_TIMEOUT_MS) {
    errors.push(`timeout_ms must be an integer from 1 to ${MAX_TIMEOUT_MS}`);
  }

  const allow_fallback = input.allow_fallback === undefined
    ? false
    : input.allow_fallback;
  if (typeof allow_fallback !== "boolean") {
    errors.push("allow_fallback must be a boolean");
  }

  if (backend && !BACKENDS.has(backend)) errors.push(`unknown backend: ${backend}`);
  if (task && task !== "probe") errors.push(`unknown task: ${task}`);
  if (mode && !MODES.has(mode)) errors.push(`unknown mode: ${mode}`);
  if (mode === "scoped-write") errors.push("scoped-write is disabled in phase one");

  const request = {
    backend,
    task,
    ...(workspace === undefined ? {} : { workspace }),
    mode,
    timeout_ms,
    allow_fallback,
  };
  return { ok: errors.length === 0, errors, request };
}

export function validateResult(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["result must be an object"] };
  }

  if (typeof input.backend !== "string" || !BACKENDS.has(input.backend)) {
    errors.push("result.backend must be a known backend");
  }
  if (typeof input.status !== "string" || !STATUSES.has(input.status)) {
    errors.push("result.status must be a known status");
  }
  if (!Number.isInteger(input.elapsed_ms) || input.elapsed_ms < 0) {
    errors.push("result.elapsed_ms must be a non-negative integer");
  }

  const hasExitCode = Number.isInteger(input.exit_code);
  const hasSignal = typeof input.signal === "string" && input.signal.trim().length > 0;
  if (!hasExitCode && !hasSignal) errors.push("result must include an exit outcome");

  if (typeof input.fallback_used !== "boolean") {
    errors.push("result.fallback_used must be a boolean");
  }
  if (!input.postcondition || typeof input.postcondition !== "object") {
    errors.push("result.postcondition is required");
  } else if (typeof input.postcondition.passed !== "boolean") {
    errors.push("result.postcondition.passed must be a boolean");
  }

  return { ok: errors.length === 0, errors };
}

export function makeResult(fields = {}) {
  const result = {
    status: STATUSES.has(fields.status) ? fields.status : "UNKNOWN",
    backend: typeof fields.backend === "string" ? fields.backend.trim() : "",
    fallback_used: fields.fallback_used === true,
    elapsed_ms: Number.isInteger(fields.elapsed_ms) && fields.elapsed_ms >= 0
      ? fields.elapsed_ms
      : 0,
    exit_code: Number.isInteger(fields.exit_code) ? fields.exit_code : null,
    signal: typeof fields.signal === "string" && fields.signal.trim()
      ? fields.signal.trim()
      : null,
    stdout: truncate(fields.stdout),
    stderr: truncate(fields.stderr),
    postcondition: fields.postcondition && typeof fields.postcondition === "object"
      ? {
        ...fields.postcondition,
        passed: fields.postcondition.passed === true,
      }
      : { passed: false, checks: [] },
  };

  if (fields.error !== undefined) result.error = truncate(fields.error);
  return result;
}
