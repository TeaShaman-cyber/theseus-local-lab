#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="${THESEUS_SONAR_VENV:-$HOME/.cache/theseus-sonar/venv}"

progress() {
  printf '{"event":"%s","detail":"%s"}\n' "$1" "$2" >&2
}

progress bootstrap_start "$VENV"
python3 -m venv "$VENV"
progress pip_install "duckdb rank-bm25"
"$VENV/bin/python" -m pip install --disable-pip-version-check -q -r "$ROOT/tools/sonar_local/requirements.txt"
progress bootstrap_complete "$VENV"
"$VENV/bin/python" -c 'import duckdb, rank_bm25; print("sonar-wsl-ok")'
