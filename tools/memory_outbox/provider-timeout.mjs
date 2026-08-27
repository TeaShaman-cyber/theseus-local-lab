import { spawn } from "node:child_process";

const DEFAULT_PROVIDER_TIMEOUT_MS = 5000;

export function providerTimeoutMs(value) {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_PROVIDER_TIMEOUT_MS;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = providerTimeoutMs(process.env.MEMORY_OUTBOX_PROVIDER_TIMEOUT_MS)) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), providerTimeoutMs(timeoutMs));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function spawnWithTimeout(command, args, options = {}, timeoutMs = providerTimeoutMs(process.env.MEMORY_OUTBOX_PROVIDER_TIMEOUT_MS)) {
  const { input = "", ...spawnOptions } = options;
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stdout = "";
    let stderr = "";
    let child;
    let timer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr, timedOut });
    };

    try {
      child = spawn(command, args, {
        ...spawnOptions,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      finish({ code: null, stderr: error.message });
      return;
    }

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => finish({ code: null, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => finish({ code }));
    timer = setTimeout(() => {
      timedOut = true;
      stderr += `provider process timeout after ${providerTimeoutMs(timeoutMs)}ms`;
      child.kill();
    }, providerTimeoutMs(timeoutMs));
    child.stdin.end(input);
  });
}
