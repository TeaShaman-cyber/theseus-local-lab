import { stderr as defaultStream } from "node:process";

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function percent(current, total) {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null;
  return Number(((current / total) * 100).toFixed(1));
}

function cleanEvent(event) {
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
}

export function createProgressReporter({
  operation,
  stream = defaultStream,
  minIntervalMs = 750,
  clock = () => new Date(),
} = {}) {
  if (!operation) throw new Error("createProgressReporter requires operation");
  let lastEmittedAt = 0;

  function emit(phase, data = {}, options = {}) {
    const nowMs = Date.now();
    if (!options.force && nowMs - lastEmittedAt < minIntervalMs) return false;
    lastEmittedAt = nowMs;
    const event = cleanEvent({
      ts: clock().toISOString(),
      event: "progress",
      operation,
      phase,
      ...data,
    });
    stream.write(`${JSON.stringify(event)}\n`);
    return true;
  }

  return {
    emit,
    heartbeat(phase, message, data = {}) {
      return emit(phase, { message, ...data }, { force: true });
    },
    done(message, data = {}) {
      return emit("done", { message, ...data }, { force: true });
    },
  };
}

export function createByteProgress({ operation, total = null, stream, minIntervalMs } = {}) {
  const reporter = createProgressReporter({ operation, stream, minIntervalMs });
  return {
    start(message = "started") {
      reporter.heartbeat("start", message, {
        total,
        total_human: total ? formatBytes(total) : undefined,
        unit: "bytes",
      });
    },
    update(current, data = {}) {
      reporter.emit("transfer", {
        current,
        current_human: formatBytes(current),
        total,
        total_human: total ? formatBytes(total) : undefined,
        percent: percent(current, total),
        unit: "bytes",
        ...data,
      });
    },
    done(current, message = "completed", data = {}) {
      reporter.done(message, {
        current,
        current_human: formatBytes(current),
        total,
        total_human: total ? formatBytes(total) : undefined,
        percent: percent(current, total),
        unit: "bytes",
        ...data,
      });
    },
  };
}
