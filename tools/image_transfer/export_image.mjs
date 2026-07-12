#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const image = process.argv[2] || "theseus-mempalace:pilot";
const outDir = process.argv[3] || join("work", "image-transfer");

function slugifyImage(value) {
  return value
    .replace(/[@/:]+/g, "-")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
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

await mkdir(outDir, { recursive: true });

const slug = slugifyImage(image);
const tarPath = join(outDir, `${slug}.tar`);
const manifestPath = join(outDir, `${slug}.manifest.json`);

run("docker", ["image", "inspect", image]);
run("docker", ["save", "--output", tarPath, image]);

const fileStat = await stat(tarPath);
const digest = await sha256(tarPath);

const manifest = {
  schema_version: 1,
  image,
  created_at: new Date().toISOString(),
  source_host: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown",
  source_platform: platform(),
  archive: basename(tarPath),
  sha256: digest,
  size_bytes: fileStat.size,
  notes: "Image layers only; no volumes, env files, secrets, or AutoMem data.",
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ tarPath, manifestPath, sha256: digest }, null, 2));
