import { spawn } from "node:child_process";

const password = process.env.UBUNTU_VM_SSH_PASSWORD;
if (!password) {
  console.error("Missing UBUNTU_VM_SSH_PASSWORD in the injected environment.");
  process.exit(2);
}

const packages = [
  "bubblewrap",
  "build-essential",
  "fd-find",
  "git",
  "jq",
  "python3-pip",
  "python3-venv",
  "ripgrep",
  "shellcheck",
  "shfmt",
];

const remoteScript = [
  "set -euo pipefail",
  "echo '{\"event\":\"wsl_ide\",\"stage\":\"apt_update\"}'",
  "apt-get update -qq",
  `echo '{\"event\":\"wsl_ide\",\"stage\":\"install\",\"packages\":${JSON.stringify(packages)}}'`,
  `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages.join(" ")}`,
  "echo '{\"event\":\"wsl_ide\",\"stage\":\"complete\"}'",
].join("\n");

const child = spawn(
  "wsl.exe",
  ["-u", "poklad", "bash", "-lc", "sudo -S -p '' bash -s"],
  { stdio: ["pipe", "inherit", "inherit"], windowsHide: true },
);

child.stdin.write(`${password}\n`);
child.stdin.end(remoteScript);

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal || code !== 0) process.exit(code ?? 1);
});
