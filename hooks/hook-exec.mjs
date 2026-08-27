import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TIMEOUT_MS = 5000;

function configuredTimeout(value) {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
}

export function runNode(args, input, { timeoutMs = configuredTimeout(process.env.THESEUS_HOOK_CHILD_TIMEOUT_MS) } = {}) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: configuredTimeout(timeoutMs),
  });
}
