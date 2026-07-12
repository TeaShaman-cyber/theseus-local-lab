import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const infisical = path.join(
  repoRoot,
  "tools",
  "infisical_cli",
  "node_modules",
  process.platform === "win32"
    ? path.join("@infisical", "cli", "bin", "infisical.exe")
    : path.join(".bin", "infisical"),
);

const args = process.argv.slice(2);
let provider = "BOTHUB";
const passthrough = [];

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--provider" && args[i + 1]) {
    provider = args[i + 1].toUpperCase();
    i += 1;
  } else {
    passthrough.push(args[i]);
  }
}

if (!["BOTHUB", "XAI"].includes(provider)) {
  console.error("Provider must be BOTHUB or XAI.");
  process.exit(2);
}

const codewhaleArgs = passthrough.length > 0
  ? passthrough
  : ["exec", "Reply exactly: codewhale-ok"];

const command = [
  "run",
  "--env=local",
  "--path=/providers",
  "--",
  "pwsh",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  ".\\scripts\\codewhale.ps1",
  "-ProviderPrefix",
  provider,
  ...codewhaleArgs,
];

const child = spawn(infisical, command, {
  cwd: repoRoot,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`CodeWhale Infisical runner terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
