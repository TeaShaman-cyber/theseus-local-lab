#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import os from "node:os";
import path from "node:path";
import { createByteProgress, createProgressReporter } from "../progress/progress.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const defaultInstallDir = path.join(os.homedir(), "Tools", "Sysinternals");
const defaultWorkDir = path.join(repoRoot, "work", "sysinternals");
const defaultOutputDir = path.join(repoRoot, "outputs", "sysinternals_scout");
const suiteUrl = "https://download.sysinternals.com/files/SysinternalsSuite.zip";

function parseArgs(argv) {
  const args = {
    installDir: process.env.THESEUS_SYSINTERNALS_DIR || defaultInstallDir,
    workDir: defaultWorkDir,
    outputDir: defaultOutputDir,
    json: false,
    reuseArchive: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--install-dir") args.installDir = path.resolve(argv[++i] || args.installDir);
    else if (item === "--work-dir") args.workDir = path.resolve(argv[++i] || args.workDir);
    else if (item === "--output-dir") args.outputDir = path.resolve(argv[++i] || args.outputDir);
    else if (item === "--json") args.json = true;
    else if (item === "--reuse-archive") args.reuseArchive = true;
  }
  return args;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination);
    const request = get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        download(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`download failed: HTTP ${response.statusCode}`));
        return;
      }
      const total = Number(response.headers["content-length"] || 0);
      let received = 0;
      const progress = createByteProgress({ operation: "sysinternals-suite-download", total });
      progress.start("Downloading Sysinternals Suite");
      response.on("data", (chunk) => {
        received += chunk.length;
        progress.update(received);
      });
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        progress.done(received, "Download complete");
        resolve();
      });
    });
    request.on("error", (error) => {
      file.close();
      reject(error);
    });
  });
}

function run(command, args, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}${stderr ? "\n" : ""}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function installedExecutables(installDir) {
  if (!existsSync(installDir)) return [];
  return readdirSync(installDir)
    .filter((name) => name.toLowerCase().endsWith(".exe"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const filePath = path.join(installDir, name);
      const stat = statSync(filePath);
      return { name, path: filePath, bytes: stat.size, modified_at: stat.mtime.toISOString() };
    });
}

function renderMarkdown(manifest) {
  const lines = [
    "# Sysinternals Install Manifest",
    "",
    `Generated: ${manifest.generated_at}`,
    `Install dir: ${manifest.install_dir}`,
    `Source: ${manifest.source_url}`,
    `Executables: ${manifest.exe_count}`,
    "",
    "| Executable | Size |",
    "|---|---:|",
  ];
  for (const item of manifest.executables.slice(0, 80)) {
    lines.push(`| ${item.name} | ${item.bytes} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const progress = createProgressReporter({ operation: "sysinternals-suite-install" });
  mkdirSync(args.workDir, { recursive: true });
  mkdirSync(args.installDir, { recursive: true });
  mkdirSync(args.outputDir, { recursive: true });

  const archivePath = path.join(args.workDir, "SysinternalsSuite.zip");
  if (args.reuseArchive && existsSync(archivePath)) {
    progress.heartbeat("reuse-archive", "Reusing existing archive", { archive_path: archivePath });
  } else {
    await download(suiteUrl, archivePath);
  }

  progress.heartbeat("extract", "Extracting Sysinternals Suite", { install_dir: args.installDir });
  const extract = await run("tar.exe", ["-xf", archivePath, "-C", args.installDir]);
  if (!extract.ok) {
    throw new Error(`tar extraction failed: ${extract.stderr || extract.stdout || extract.code}`);
  }

  const executables = installedExecutables(args.installDir);
  const manifest = {
    ok: executables.length > 0,
    generated_at: new Date().toISOString(),
    source_url: suiteUrl,
    archive_path: archivePath,
    install_dir: args.installDir,
    exe_count: executables.length,
    executables,
  };

  writeFileSync(path.join(args.outputDir, "install-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(path.join(args.outputDir, "install-manifest.md"), renderMarkdown(manifest), "utf8");
  progress.done("Sysinternals install manifest written", {
    exe_count: manifest.exe_count,
    manifest_path: path.join(args.outputDir, "install-manifest.json"),
  });

  if (args.json) console.log(JSON.stringify(manifest, null, 2));
  else {
    console.log(`Installed ${manifest.exe_count} Sysinternals executables`);
    console.log(`Install dir: ${manifest.install_dir}`);
    console.log(`Manifest: ${path.join(args.outputDir, "install-manifest.json")}`);
  }

  process.exitCode = manifest.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
