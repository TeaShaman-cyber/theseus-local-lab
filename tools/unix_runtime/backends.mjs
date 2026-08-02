import { BACKENDS, MAX_FIELD_CHARS } from "./contract.mjs";

const WSL_PROBE = "printf 'runtime=wsl\\n'; uname -s; command -v node || true; command -v git || true";
const VM_PROBE = "printf 'runtime=ubuntu-vm\\n'; uname -s; command -v node || true; command -v git || true";
const CODEX_DO_WORKSPACE = "/root/workspaces/family-research-lab";
const CODEX_DO_PROBE = [
  "printf 'runtime=codex-do\\n'",
  "printf 'physical_scope=remote-do\\n'",
  "printf 'project_scope=family-research\\n'",
  "printf 'remote_host='",
  "hostname",
  "printf 'remote_user='",
  "id -un",
  `if [ -d ${CODEX_DO_WORKSPACE} ]; then printf 'workspace_present=true\\n'; else printf 'workspace_present=false\\n'; fi`,
  `printf 'workspace=${CODEX_DO_WORKSPACE}\\n'`,
  `git -C ${CODEX_DO_WORKSPACE} rev-parse --show-toplevel 2>/dev/null | sed 's/^/git_root=/' || true`,
  `git -C ${CODEX_DO_WORKSPACE} rev-parse HEAD 2>/dev/null | sed 's/^/git_head=/' || true`,
  `printf 'tracked_change_count='; git -C ${CODEX_DO_WORKSPACE} status --porcelain=v1 --untracked-files=no 2>/dev/null | wc -l`,
  `printf 'untracked_count='; git -C ${CODEX_DO_WORKSPACE} ls-files --others --exclude-standard 2>/dev/null | wc -l`,
].join("; ");

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
  "codex-do": Object.freeze({
    id: "codex-do",
    command: "ssh",
    description: "Family Research remote runtime over explicit SSH",
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

  if (backend === "codex-do") {
    const host = readSafeAlias(options, "host");
    const user = readSafeAlias(options, "user");
    return invocation("ssh", [
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "ConnectTimeout=10",
      `${user}@${host}`,
      CODEX_DO_PROBE,
    ]);
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
