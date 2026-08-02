import test from "node:test";
import assert from "node:assert/strict";
import { buildProbeInvocation, getBackendSpec } from "./backends.mjs";

test("builds a WSL probe with explicit distro and cwd", () => {
  const invocation = buildProbeInvocation("wsl", {
    distro: "Ubuntu-24.04",
    cwd: "/home/poklad/theseus-local-lab",
  });
  assert.equal(invocation.command, "wsl.exe");
  assert.deepEqual(invocation.args.slice(0, 5), [
    "-d",
    "Ubuntu-24.04",
    "--cd",
    "/home/poklad/theseus-local-lab",
    "--",
  ]);
  assert.equal(invocation.shell, false);
});

test("builds Docker and VM probes without caller shell interpolation", () => {
  const docker = buildProbeInvocation("docker", {});
  const vm = buildProbeInvocation("ubuntu-vm", { host: "theseus-ubuntu-vm" });
  assert.equal(docker.command, "docker.exe");
  assert.equal(vm.command, "ssh");
  assert.equal(docker.shell, false);
  assert.equal(vm.shell, false);
  assert.equal(vm.args[4], "theseus-ubuntu-vm");
  assert.match(String(vm.args.at(-1)), /^printf 'runtime=ubuntu-vm\\n'; uname -s;/);
  assert.ok(!String(vm.args.at(-1)).includes("theseus-ubuntu-vm"));
  assert.throws(
    () => buildProbeInvocation("ubuntu-vm", { host: "theseus-ubuntu-vm; whoami" }),
    /host/i,
  );
});

test("builds an isolated codex-do probe with fixed Family Research scope", () => {
  const remote = buildProbeInvocation("codex-do", {
    host: "138.68.66.30",
    user: "root",
  });
  assert.equal(remote.command, "ssh");
  assert.equal(remote.shell, false);
  assert.ok(remote.args.includes("root@138.68.66.30"));
  assert.ok(!remote.args.includes("sh"));
  assert.ok(!remote.args.includes("-lc"));
  assert.match(String(remote.args.at(-1)), /runtime=codex-do/);
  assert.match(String(remote.args.at(-1)), /physical_scope=remote-do/);
  assert.match(String(remote.args.at(-1)), /project_scope=family-research/);
  assert.match(String(remote.args.at(-1)), /root\/workspaces\/family-research-lab/);
  assert.ok(!String(remote.args.at(-1)).includes("138.68.66.30"));
  assert.throws(
    () => buildProbeInvocation("codex-do", { host: "138.68.66.30", user: "root; whoami" }),
    /user/i,
  );
});

test("rejects unknown backends", () => {
  assert.throws(() => buildProbeInvocation("local-shell", {}), /backend/i);
});

test("returns backend metadata without exposing the registry object", () => {
  const spec = getBackendSpec("wsl");
  assert.deepEqual(spec, {
    id: "wsl",
    command: "wsl.exe",
    description: "Windows Subsystem for Linux",
  });
  assert.notEqual(spec, getBackendSpec("wsl"));
  assert.throws(() => getBackendSpec("local-shell"), /backend/i);
});
