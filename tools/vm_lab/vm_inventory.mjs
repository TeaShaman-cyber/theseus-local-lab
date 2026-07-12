#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..", "..");
const outDir = resolve(root, "outputs", "local_inventory");
const now = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(outDir, `${now}-vmware-ubuntu.json`);

const host = process.env.THESEUS_VM_HOST || "192.168.121.130";
const user = process.env.THESEUS_VM_USER || "sysadmin";
const key = process.env.THESEUS_VM_KEY || "";
const target = `${user}@${host}`;

const remoteScript = String.raw`
set -u
echo "__SECTION__ identity"
whoami
hostname
echo "__SECTION__ os"
if [ -r /etc/os-release ]; then cat /etc/os-release; fi
uname -a
echo "__SECTION__ resources"
printf "uptime="
uptime -p || true
printf "memory="
free -h || true
printf "disk="
df -h / /home 2>/dev/null || df -h /
echo "__SECTION__ network"
ip -4 addr show || true
ip route || true
echo "__SECTION__ tools"
for c in git python3 python node npm docker podman code rg jq curl ssh systemctl; do
  if command -v "$c" >/dev/null 2>&1; then
    printf "%s=" "$c"
    command -v "$c"
    "$c" --version 2>&1 | head -n 1 || true
  else
    printf "%s=missing\n" "$c"
  fi
done
echo "__SECTION__ services"
systemctl is-active ssh 2>/dev/null || true
systemctl is-enabled ssh 2>/dev/null || true
systemctl is-active docker 2>/dev/null || true
systemctl is-enabled docker 2>/dev/null || true
echo "__SECTION__ vmware"
vmware-toolbox-cmd -v 2>/dev/null || true
`;

const args = [
  "-o",
  "ConnectTimeout=10",
  "-o",
  "StrictHostKeyChecking=accept-new",
];

if (key) {
  args.push("-i", key, "-o", "BatchMode=yes");
}

args.push(target, "sh", "-lc", remoteScript);

const result = spawnSync("ssh", args, {
  cwd: root,
  encoding: "utf8",
  shell: false,
  maxBuffer: 1024 * 1024 * 5,
});

const payload = {
  created_at: new Date().toISOString(),
  target,
  host,
  user,
  used_key: Boolean(key),
  exit_code: result.status,
  signal: result.signal,
  stdout: result.stdout || "",
  stderr: result.stderr || "",
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

if (result.status === 0) {
  console.log(`VM inventory written: ${outPath}`);
} else {
  console.error(`VM inventory failed, details written: ${outPath}`);
  process.exitCode = result.status || 1;
}
