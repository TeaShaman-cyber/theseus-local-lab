#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { exit } from "node:process";

function runWsl(script, timeoutMs = 30_000) {
  const result = spawnSync("wsl.exe", ["-e", "bash", "-lc", script], {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error?.message,
  };
}

const dollar = "$";

const script = String.raw`
set -euo pipefail

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

KEY="$HOME/.ssh/id_ed25519_theseus_wsl"
AGENT_ENV="$HOME/.ssh/agent-env"
PROFILE="$HOME/.profile"
MARKER_START="# >>> theseus-wsl-ssh-agent >>>"
MARKER_END="# <<< theseus-wsl-ssh-agent <<<"

if [ ! -f "$KEY" ]; then
  ssh-keygen -t ed25519 -f "$KEY" -N "" -C "theseus-wsl-agent@$(hostname)" >/dev/null
fi
chmod 600 "$KEY"
chmod 644 "$KEY.pub"

start_agent() {
  ssh-agent -s | sed 's/^echo/# echo/' > "$AGENT_ENV"
  chmod 600 "$AGENT_ENV"
}

if [ -f "$AGENT_ENV" ]; then
  # shellcheck disable=SC1090
  . "$AGENT_ENV" >/dev/null 2>&1 || true
fi

if [ -z "${dollar}{SSH_AUTH_SOCK:-}" ] || [ ! -S "${dollar}{SSH_AUTH_SOCK:-}" ] || ! ssh-add -l >/dev/null 2>&1; then
  start_agent
  # shellcheck disable=SC1090
  . "$AGENT_ENV" >/dev/null 2>&1
fi

ssh-add "$KEY" >/dev/null 2>&1 || true

PROFILE_BLOCK='
# >>> theseus-wsl-ssh-agent >>>
if [ -f "$HOME/.ssh/agent-env" ]; then
  . "$HOME/.ssh/agent-env" >/dev/null 2>&1 || true
fi
if [ -z "${dollar}{SSH_AUTH_SOCK:-}" ] || [ ! -S "${dollar}{SSH_AUTH_SOCK:-}" ] || ! ssh-add -l >/dev/null 2>&1; then
  ssh-agent -s | sed "s/^echo/# echo/" > "$HOME/.ssh/agent-env"
  chmod 600 "$HOME/.ssh/agent-env"
  . "$HOME/.ssh/agent-env" >/dev/null 2>&1
fi
if [ -f "$HOME/.ssh/id_ed25519_theseus_wsl" ]; then
  ssh-add "$HOME/.ssh/id_ed25519_theseus_wsl" >/dev/null 2>&1 || true
fi
# <<< theseus-wsl-ssh-agent <<<
'

touch "$PROFILE"
if grep -Fq "$MARKER_START" "$PROFILE"; then
  TMP_PROFILE="$(mktemp)"
  awk -v start="$MARKER_START" -v end="$MARKER_END" '
    index($0, start) { skip = 1; next }
    index($0, end) { skip = 0; next }
    !skip { print }
  ' "$PROFILE" > "$TMP_PROFILE"
  cat "$TMP_PROFILE" > "$PROFILE"
  rm -f "$TMP_PROFILE"
fi
printf "%s\n" "$PROFILE_BLOCK" >> "$PROFILE"

printf 'status=OK\n'
printf 'key=%s\n' "$KEY"
printf 'public_key=%s\n' "$KEY.pub"
printf 'agent_sock=%s\n' "${dollar}{SSH_AUTH_SOCK:-}"
ssh-add -l 2>&1 | sed -e 's/[A-Za-z0-9+\/=]\{20,\}/<redacted>/g'
`;

const result = runWsl(script);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) exit(1);
