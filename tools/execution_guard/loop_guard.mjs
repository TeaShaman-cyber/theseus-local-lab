function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function evaluateAttempts(attempts = []) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    throw new Error("evaluateAttempts requires at least one attempt");
  }

  const normalized = attempts.map((attempt) => ({
    route: normalize(attempt?.route),
    failure: normalize(attempt?.failure),
  }));
  if (normalized.some((attempt) => !attempt.route || !attempt.failure)) {
    throw new Error("every attempt needs a route and failure class");
  }

  const first = normalized[0];
  const materiallyEquivalent = normalized.every(
    (attempt) => attempt.route === first.route && attempt.failure === first.failure,
  );

  if (!materiallyEquivalent) {
    return {
      status: "different-failure-class",
      attempts: normalized.length,
      route: first.route,
      failure_class: first.failure,
      action: "reassess-route",
      note: "Attempts differ; do not count them as one blind-retry loop.",
    };
  }

  if (normalized.length >= 3) {
    return {
      status: "LOOP_DETECTED",
      attempts: normalized.length,
      route: first.route,
      failure_class: first.failure,
      action: "stop-blind-retry",
      fallback: "choose a compatible executor or ask the user",
    };
  }

  return {
    status: "below-loop-threshold",
    attempts: normalized.length,
    route: first.route,
    failure_class: first.failure,
    action: "one-valid-retry-or-fallback",
  };
}

function parseCli(argv) {
  const values = { route: "", failure: "", attempts: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--route") values.route = argv[++index] || "";
    else if (item === "--failure") values.failure = argv[++index] || "";
    else if (item === "--attempts") values.attempts = Number(argv[++index] || 0);
  }
  if (!Number.isInteger(values.attempts) || values.attempts < 1) {
    throw new Error("--attempts must be a positive integer");
  }
  return values;
}

if (process.argv[1] && process.argv[1].endsWith("loop_guard.mjs")) {
  const values = parseCli(process.argv.slice(2));
  console.log(
    JSON.stringify(
      evaluateAttempts(
        Array.from({ length: values.attempts }, () => ({
          route: values.route,
          failure: values.failure,
        })),
      ),
      null,
      2,
    ),
  );
}
