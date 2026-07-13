#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cwd, exit } from "node:process";

const DEFAULT_PATHS = [
  ".gitignore",
  ".vscode/tasks.json",
  "outputs/wsl_sandbox_limitations_2026-07-13.md",
  "tools/docker_control_plane",
  "tools/git_safety/commit_checkpoint.mjs",
  "tools/memory_hook",
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    message: "Add Docker MCP bridge and compact memory hook",
    paths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1] || "";
    if (value === "--dry-run") {
      args.dryRun = true;
    } else if (value === "--message") {
      args.message = next;
      index += 1;
    } else if (value === "--path") {
      if (next) args.paths.push(next);
      index += 1;
    }
  }

  if (!args.paths.length) {
    args.paths = DEFAULT_PATHS;
  }
  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: cwd(),
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")}\n${output}`);
  }
  return { status: result.status ?? 1, output };
}

function assertSafePaths(paths) {
  const risky = paths.filter((path) =>
    /^\.env($|\.)/i.test(path) ||
    /\.(pem|key|pfx)$/i.test(path) ||
    path.startsWith("backups/") ||
    path.startsWith(".local_secrets/") ||
    path.includes("node_modules"),
  );
  if (risky.length) {
    throw new Error(`Refusing to stage risky paths: ${risky.join(", ")}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertSafePaths(args.paths);

  const existing = args.paths.filter((path) => existsSync(path));
  const missing = args.paths.filter((path) => !existsSync(path));
  if (!existing.length) {
    throw new Error("No checkpoint paths exist.");
  }

  const hooksPath = run("git", ["config", "--get", "core.hooksPath"]).output.trim();
  if (hooksPath !== ".githooks") {
    throw new Error(`Unexpected core.hooksPath: ${hooksPath || "(unset)"}`);
  }

  const status = run("git", ["status", "-sb"]).output;
  const plan = {
    ok: true,
    dry_run: args.dryRun,
    message: args.message,
    existing_paths: existing,
    missing_paths: missing,
    status,
  };

  if (args.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  run("git", ["add", "--", ...existing]);
  run("node", ["tools/git_safety/scan_staged.mjs"]);
  run("git", ["commit", "-m", args.message]);
  console.log(JSON.stringify({ ...plan, committed: true }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  exit(1);
}
