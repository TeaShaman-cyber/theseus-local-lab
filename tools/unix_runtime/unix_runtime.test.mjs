import { EventEmitter } from "node:events";
import test from "node:test";
import assert from "node:assert/strict";

import { MAX_DIAGNOSTIC_CHARS } from "./contract.mjs";
import { parseArgs, runProbe } from "./unix_runtime.mjs";

function fakeSpawn({ stdout = "", stderr = "", code = 0, delay = 0 } = {}, calls = []) {
  return (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));
      return true;
    };

    setTimeout(() => {
      if (stdout) child.stdout.emit("data", stdout);
      if (stderr) child.stderr.emit("data", stderr);
      child.emit("close", code, null);
    }, delay);
    return child;
  };
}

test("successful probe returns a bounded OK receipt with a passed postcondition", async () => {
  const calls = [];
  const result = await runProbe({
    backend: "wsl",
    task: "probe",
    distro: "Ubuntu-24.04",
    cwd: "/home/poklad/theseus-local-lab",
  }, { spawn: fakeSpawn({ stdout: "runtime=wsl\nLinux\n/usr/bin/node\n" }, calls) });

  assert.equal(result.status, "OK");
  assert.equal(result.backend, "wsl");
  assert.equal(result.exit_code, 0);
  assert.equal(result.fallback_used, false);
  assert.equal(result.postcondition.passed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.shell, false);
});

test("non-zero probe exit is visible and cannot pass its postcondition", async () => {
  const result = await runProbe({
    backend: "docker",
    task: "probe",
  }, { spawn: fakeSpawn({ stderr: "docker unavailable", code: 1 }) });

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.exit_code, 1);
  assert.equal(result.postcondition.passed, false);
  assert.equal(result.fallback_used, false);
});

test("timeout returns TIMEOUT and never reports a passed postcondition", async () => {
  const result = await runProbe({
    backend: "docker",
    task: "probe",
    timeout_ms: 20,
  }, { spawn: fakeSpawn({ delay: 100 }) });

  assert.equal(result.status, "TIMEOUT");
  assert.equal(result.postcondition.passed, false);
  assert.equal(result.fallback_used, false);
});

test("runs only the explicitly selected backend without fallback", async () => {
  const calls = [];
  const result = await runProbe({
    backend: "ubuntu-vm",
    task: "probe",
    host: "theseus-ubuntu-vm",
  }, { spawn: fakeSpawn({ stderr: "offline", code: 255 }, calls) });

  assert.equal(result.backend, "ubuntu-vm");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "ssh");
  assert.equal(result.fallback_used, false);
});

test("classifies an SSH transport exit as VM unavailable", async () => {
  const result = await runProbe({
    backend: "ubuntu-vm",
    task: "probe",
    host: "theseus-ubuntu-vm",
  }, {
    spawn: fakeSpawn({
      stderr: "ssh: connect to host 192.168.121.130 port 22: Connection timed out",
      code: 255,
    }),
  });

  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.postcondition.passed, false);
  assert.equal(result.fallback_used, false);
});

test("truncates diagnostic streams at the contract limit", async () => {
  const result = await runProbe({
    backend: "wsl",
    task: "probe",
    distro: "Ubuntu-24.04",
    cwd: "/home/poklad/theseus-local-lab",
  }, {
    spawn: fakeSpawn({
      stdout: `runtime=wsl\n/usr/bin/node\n${"x".repeat(MAX_DIAGNOSTIC_CHARS + 100)}`,
    }),
  });

  assert.equal(result.status, "OK");
  assert.ok(result.stdout.length <= MAX_DIAGNOSTIC_CHARS);
  assert.match(result.stdout, /truncated/);
});

test("parses a single backend probe command and its bounded options", () => {
  const args = parseArgs([
    "probe",
    "--backend",
    "wsl",
    "--timeout-ms",
    "5000",
    "--distro",
    "Ubuntu-24.04",
    "--cwd",
    "/home/poklad/theseus-local-lab",
    "--no-log",
  ]);

  assert.equal(args.command, "probe");
  assert.equal(args.backend, "wsl");
  assert.equal(args.timeout_ms, 5000);
  assert.equal(args.distro, "Ubuntu-24.04");
  assert.equal(args.cwd, "/home/poklad/theseus-local-lab");
  assert.equal(args.no_log, true);
});
