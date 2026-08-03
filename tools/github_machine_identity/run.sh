#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: run.sh <command> [args...]" >&2
  exit 2
fi

CFG="/home/poklad/.config/infisical/universal-auth.env"
BIN="/home/poklad/.local/bin/infisical"
PROJECT_ID="84a696fb-c0ee-49d3-b5a7-2a16a229668b"

test -r "$CFG"
test -x "$BIN"

set -a
# shellcheck disable=SC1090
source "$CFG"
set +a

: "${INFISICAL_CLIENT_ID:?missing local Machine Identity client id}"
: "${INFISICAL_CLIENT_SECRET:?missing local Machine Identity client secret}"
: "${INFISICAL_API_URL:?missing local Infisical API URL}"

session_value="$(
  "$BIN" login \
    --method=universal-auth \
    --client-id "$INFISICAL_CLIENT_ID" \
    --client-secret "$INFISICAL_CLIENT_SECRET" \
    --domain "$INFISICAL_API_URL" \
    --plain \
    --silent
)"
test -n "$session_value"

unset INFISICAL_CLIENT_ID INFISICAL_CLIENT_SECRET
exec env "INFISICAL_TOKEN=$session_value" \
  "$BIN" run \
    --projectId "$PROJECT_ID" \
    --env=local \
    --path=/infra \
    --domain "$INFISICAL_API_URL" \
    -- "$@"
