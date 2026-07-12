#!/usr/bin/env bash
set -euo pipefail

verify_only=false
if [[ "${1:-}" == "--verify-only" ]]; then
  verify_only=true
  shift
fi

archive_path="${1:-}"
manifest_path="${2:-}"

if [[ -z "$archive_path" || -z "$manifest_path" ]]; then
  echo "Usage: load_image_archive.sh [--verify-only] <image.tar> <manifest.json>" >&2
  exit 2
fi

if [[ ! -f "$archive_path" ]]; then
  echo "Archive not found: $archive_path" >&2
  exit 3
fi

if [[ ! -f "$manifest_path" ]]; then
  echo "Manifest not found: $manifest_path" >&2
  exit 4
fi

python3 - "$archive_path" "$manifest_path" <<'PY'
import hashlib
import json
import os
import sys

archive_path, manifest_path = sys.argv[1], sys.argv[2]


def emit(payload, *, error=False):
    stream = sys.stderr if error else sys.stdout
    print(json.dumps(payload, sort_keys=True), file=stream)


def fail(stage, reason, message, **extra):
    emit(
        {
            "status": "error",
            "stage": stage,
            "reason": reason,
            "message": message,
            **extra,
        },
        error=True,
    )
    raise SystemExit(1)


try:
    with open(manifest_path, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)
except Exception as exc:
    fail("manifest", "manifest_read_failed", str(exc))

schema_version = manifest.get("schema_version")
if schema_version != 1:
    fail(
        "manifest",
        "unsupported_schema_version",
        f"Unsupported manifest schema_version: {schema_version}",
        schema_version=schema_version,
    )

expected_hash = manifest.get("sha256")
expected_size = manifest.get("size_bytes")
archive_name = manifest.get("archive")
image_name = manifest.get("image")
if not expected_hash or expected_size is None or not archive_name or not image_name:
    fail(
        "manifest",
        "missing_required_fields",
        "Manifest must include image, archive, sha256 and size_bytes",
    )

actual_archive_name = os.path.basename(archive_path)
if actual_archive_name != archive_name:
    fail(
        "manifest",
        "archive_name_mismatch",
        f"Archive name mismatch: manifest has {archive_name}, got {actual_archive_name}",
        expected_archive=archive_name,
        actual_archive=actual_archive_name,
    )

actual_size = os.path.getsize(archive_path)
if int(expected_size) != actual_size:
    fail(
        "integrity",
        "size_mismatch",
        f"Size mismatch: expected {expected_size}, got {actual_size}",
        expected_size=int(expected_size),
        actual_size=actual_size,
    )

digest = hashlib.sha256()
with open(archive_path, "rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)

actual_hash = digest.hexdigest()
if expected_hash.lower() != actual_hash:
    fail(
        "integrity",
        "sha256_mismatch",
        f"SHA256 mismatch: expected {expected_hash}, got {actual_hash}",
        expected_sha256=expected_hash.lower(),
        actual_sha256=actual_hash,
    )

emit(
    {
        "status": "ok",
        "stage": "verified",
        "reason": "verified",
        "image": image_name,
        "archive": archive_name,
        "sha256": actual_hash,
        "size_bytes": actual_size,
    }
)
PY

if [[ "$verify_only" == "true" ]]; then
  exit 0
fi

docker load --input "$archive_path"

image_name="$(python3 - "$manifest_path" <<'PY'
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as handle:
    print(json.load(handle)["image"])
PY
)"

docker image inspect "$image_name" \
  --format 'id={{.Id}} size={{.Size}} created={{.Created}} tags={{json .RepoTags}}'
