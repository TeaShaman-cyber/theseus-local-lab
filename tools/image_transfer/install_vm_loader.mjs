#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const sshAlias = process.argv[2] || "theseus-ubuntu-vm";
const localScript = "tools/image_transfer/load_image_archive.sh";
const remoteScript = `${sshAlias}:~/theseus-local-lab/bin/load_image_archive.sh`;

const sshOptions = [
  "-o",
  "BatchMode=yes",
  "-o",
  "StrictHostKeyChecking=yes",
];

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

run("ssh", [...sshOptions, sshAlias, "mkdir -p ~/theseus-local-lab/bin"]);
run("scp", [...sshOptions, localScript, remoteScript]);
run("ssh", [
  ...sshOptions,
  sshAlias,
  "chmod +x ~/theseus-local-lab/bin/load_image_archive.sh",
]);

console.log(`Installed VM loader on ${sshAlias}`);
