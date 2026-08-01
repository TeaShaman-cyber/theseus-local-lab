import { BACKENDS, MAX_FIELD_CHARS } from "./contract.mjs";

const WSL_PROBE = "printf 'runtime=wsl\\n'; uname -s; command -v node || true; command -v git || true";
const VM_PROBE = "printf 'runtime=ubuntu-vm\\n'; uname -s; command -v node || true; command -v git || true";

const BACKEND_SPECS = Object.freeze({
  wsl: Object.freeze({
    id: "wsl",
    command: "wsl.exe",
    description: "Windows Subsystem for Linux",
  }),
  docker: Object.freeze({
    id: "docker",
    command: "docker.exe",
    description: "Docker engine",
  }),
  "ubuntu-vm": Object.freeze({
    id: "ubuntu-vm",
    command: "ssh",
    description: "Ubuntu VM over the configured SSH alias",
  }),
});

export { BACKEND_SPECS };

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SAFE_ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function assertOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("backend options must be an object");
  }
}

function readBoundedString(options, field) {
  const value = options[field];
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) throw new TypeError(`${field} must not be empty`);
  if (trimmed.length > MAX_FIELD_CHARS) {
    throw new TypeError(`${field} is too long`);
  }
  if (CONTROL_CHARACTERS.test(trimmed)) {
    throw new TypeError(`${field} contains control characters`);
  }
  return trimmed;
}

function readSafeAlias(options, field) {
  const value = readBoundedString(options, field);
  if (!SAFE_ALIAS.test(value)) {
    throw new TypeError(`${field} contains unsafe shell characters`);
  }
  return value;
}

function invocation(command, args) {
  return {
    command,
    args: [...args],
    cwd: undefined,
    env: undefined,
    shell: false,
  };
}

export function buildProbeInvocation(backend, options = {}) {
  if (typeof backend !== "string" || !BACKENDS.has(backend)) {
    throw new TypeError(`unknown backend: ${String(backend)}`);
  }
  assertOptions(options);

  if (backend === "wsl") {
    const distro = readSafeAlias(options, "distro");
    const cwd = readBoundedString(options, "cwd");
    return invocation("wsl.exe", [
      "-d",
      distro,
      "--cd",
      cwd,
      "--",
      "sh",
      "-lc",
      WSL_PROBE,
    ]);
  }

  if (backend === "docker") {
    return invocation("docker.exe", ["version", "--format", "{{.Server.Version}}"]);
  }

  const host = readSafeAlias(options, "host");
  return invocation("ssh", [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=5",
    host,
    "sh",
    "-lc",
    VM_PROBE,
  ]);
}

export function getBackendSpec(backend) {
  if (typeof backend !== "string" || !BACKENDS.has(backend)) {
    throw new TypeError(`unknown backend: ${String(backend)}`);
  }
  return { ...BACKEND_SPECS[backend] };
}
