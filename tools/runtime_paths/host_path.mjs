import { existsSync } from "node:fs";

export function windowsPathToWsl(value) {
  const match = String(value || "").match(/^([A-Za-z]):[\\/](.*)$/);
  if (!match) return null;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

export function resolveHostPath(value, options = {}) {
  const exists = options.exists || existsSync;
  const platform = options.platform || process.platform;
  const raw = String(value || "");
  if (exists(raw)) return raw;
  if (platform !== "win32") {
    const wsl = windowsPathToWsl(raw);
    if (wsl && exists(wsl)) return wsl;
  }
  return raw;
}

export function preferredDockerHost(options = {}) {
  const configured = String(options.configuredHost || "").trim();
  if (configured) return configured;
  const exists = options.exists || existsSync;
  const platform = options.platform || process.platform;
  if (platform !== "win32" && exists("/var/run/docker.sock")) return "unix:///var/run/docker.sock";
  return "tcp://127.0.0.1:2375";
}
