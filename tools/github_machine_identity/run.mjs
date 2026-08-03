import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const commandArgs = process.argv.slice(2);

if (commandArgs.length === 0) {
  console.error("Usage: node tools/github_machine_identity/run.mjs <command> [args...]");
  process.exit(2);
}

function toWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath).replaceAll("\\", "/");
  const drive = normalized[0].toLowerCase();
  return `/mnt/${drive}${normalized.slice(2)}`;
}

const launcher = toWslPath(path.join(repoRoot, "tools", "github_machine_identity", "run.sh"));
const child = spawn("wsl.exe", ["bash", launcher, ...commandArgs], {
  cwd: repoRoot,
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`github machine-identity launcher failed: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`github machine-identity launcher terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
