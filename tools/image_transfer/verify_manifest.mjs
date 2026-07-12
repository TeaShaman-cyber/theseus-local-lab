#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

const archivePath = process.argv[2];
const manifestPath = process.argv[3];

function emit(payload, error = false) {
  const line = `${JSON.stringify(payload, Object.keys(payload).sort())}\n`;
  (error ? process.stderr : process.stdout).write(line);
}

function fail(stage, reason, message, extra = {}) {
  emit({ status: "error", stage, reason, message, ...extra }, true);
  process.exit(1);
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolve);
  });
  return hash.digest("hex");
}

if (!archivePath || !manifestPath) {
  fail(
    "usage",
    "missing_arguments",
    "Usage: verify_manifest.mjs <image.tar> <manifest.json>"
  );
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  fail("manifest", "manifest_read_failed", error.message);
}

if (manifest.schema_version !== 1) {
  fail(
    "manifest",
    "unsupported_schema_version",
    `Unsupported manifest schema_version: ${manifest.schema_version}`,
    { schema_version: manifest.schema_version }
  );
}

const required = ["image", "archive", "sha256", "size_bytes"];
const missing = required.filter((field) => !manifest[field] && manifest[field] !== 0);
if (missing.length > 0) {
  fail("manifest", "missing_required_fields", "Manifest is missing required fields", {
    missing: missing.join(","),
  });
}

const actualArchive = basename(archivePath);
if (actualArchive !== manifest.archive) {
  fail(
    "manifest",
    "archive_name_mismatch",
    `Archive name mismatch: manifest has ${manifest.archive}, got ${actualArchive}`,
    { expected_archive: manifest.archive, actual_archive: actualArchive }
  );
}

let archiveStat;
try {
  archiveStat = await stat(archivePath);
} catch (error) {
  fail("archive", "archive_stat_failed", error.message);
}

if (Number(manifest.size_bytes) !== archiveStat.size) {
  fail(
    "integrity",
    "size_mismatch",
    `Size mismatch: expected ${manifest.size_bytes}, got ${archiveStat.size}`,
    { expected_size: Number(manifest.size_bytes), actual_size: archiveStat.size }
  );
}

const actualHash = await sha256(archivePath);
if (String(manifest.sha256).toLowerCase() !== actualHash) {
  fail(
    "integrity",
    "sha256_mismatch",
    `SHA256 mismatch: expected ${manifest.sha256}, got ${actualHash}`,
    { expected_sha256: String(manifest.sha256).toLowerCase(), actual_sha256: actualHash }
  );
}

emit({
  status: "ok",
  stage: "verified",
  reason: "verified",
  image: manifest.image,
  archive: manifest.archive,
  sha256: actualHash,
  size_bytes: archiveStat.size,
});
