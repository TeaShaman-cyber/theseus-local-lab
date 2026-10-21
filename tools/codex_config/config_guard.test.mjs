import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConfigCandidate,
  parseDoctorResult,
  resolveCodexHome,
  validateConfigCandidate,
} from "./config_guard.mjs";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "theseus-codex-config-guard-test-"));
}

function doctorRunner({ parseStatus = "ok", exitCode = 0 } = {}) {
  const calls = [];
  const run = (executable, args, options) => {
    calls.push({ executable, args, options });
    return {
      status: exitCode,
      stdout: JSON.stringify({
        checks: {
          "config.load": {
            details: { "config.toml parse": parseStatus },
          },
        },
      }),
      stderr: "",
    };
  };
  run.calls = calls;
  return run;
}

test("resolveCodexHome prefers CODEX_HOME and never prints config contents", () => {
  assert.equal(resolveCodexHome({ CODEX_HOME: "C:\\isolated\\codex" }, "win32"), path.resolve("C:\\isolated\\codex"));
  assert.equal(resolveCodexHome({ USERPROFILE: "C:\\Users\\tester" }, "win32"), path.resolve("C:\\Users\\tester", ".codex"));
});

test("parseDoctorResult accepts only a successful config parse", () => {
  assert.deepEqual(
    parseDoctorResult({
      status: 0,
      stdout: JSON.stringify({ checks: { "config.load": { details: { "config.toml parse": "ok" } } } }),
      stderr: "",
    }),
    { ok: true, code: "CONFIG_OK" },
  );
  assert.deepEqual(
    parseDoctorResult({
      status: 0,
      stdout: JSON.stringify({ checks: { "config.load": { details: { "config.toml parse": "invalid" } } } }),
      stderr: "",
    }),
    { ok: false, code: "CONFIG_INVALID" },
  );
});

test("validateConfigCandidate runs doctor in an isolated temporary CODEX_HOME", () => {
  const dir = tempDir();
  try {
    const candidate = path.join(dir, "candidate.toml");
    writeFileSync(candidate, "[safe]\nvalue = true\n", "utf8");
    const runner = doctorRunner();
    const result = validateConfigCandidate({ candidatePath: candidate, codexExecutable: "codex.exe", spawn: runner });

    assert.deepEqual(result, { ok: true, code: "CONFIG_OK" });
    assert.equal(runner.calls.length, 1);
    assert.notEqual(runner.calls[0].options.env.CODEX_HOME, dir);
    assert.equal(existsSync(runner.calls[0].options.env.CODEX_HOME), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("preflight failure leaves the live config untouched", () => {
  const dir = tempDir();
  try {
    const target = path.join(dir, "config.toml");
    const candidate = path.join(dir, "candidate.toml");
    writeFileSync(target, "[old]\nvalue = true\n", "utf8");
    writeFileSync(candidate, "[new]\nvalue = true\n", "utf8");
    const runner = doctorRunner({ parseStatus: "invalid" });

    const result = applyConfigCandidate({ targetPath: target, candidatePath: candidate, codexExecutable: "codex.exe", spawn: runner });

    assert.deepEqual(result, { ok: false, code: "PREFLIGHT_FAILED" });
    assert.equal(readFileSync(target, "utf8"), "[old]\nvalue = true\n");
    assert.equal(runner.calls.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("successful apply writes the candidate and preserves a rollback backup", () => {
  const dir = tempDir();
  try {
    const target = path.join(dir, "config.toml");
    const candidate = path.join(dir, "candidate.toml");
    writeFileSync(target, "[old]\nvalue = true\n", "utf8");
    writeFileSync(candidate, "[new]\nvalue = true\n", "utf8");
    const runner = doctorRunner();

    const result = applyConfigCandidate({
      targetPath: target,
      candidatePath: candidate,
      codexExecutable: "codex.exe",
      spawn: runner,
      backupSuffix: "test-backup",
    });

    assert.deepEqual(result, { ok: true, code: "CONFIG_APPLIED" });
    assert.equal(readFileSync(target, "utf8"), "[new]\nvalue = true\n");
    assert.equal(readFileSync(`${target}.test-backup.bak`, "utf8"), "[old]\nvalue = true\n");
    assert.equal(runner.calls.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("postflight failure restores the previous config", () => {
  const dir = tempDir();
  try {
    const target = path.join(dir, "config.toml");
    const candidate = path.join(dir, "candidate.toml");
    writeFileSync(target, "[old]\nvalue = true\n", "utf8");
    writeFileSync(candidate, "[new]\nvalue = true\n", "utf8");
    let calls = 0;
    const runner = (executable, args, options) => {
      calls += 1;
      const parseStatus = calls === 1 ? "ok" : "invalid";
      return {
        status: 0,
        stdout: JSON.stringify({ checks: { "config.load": { details: { "config.toml parse": parseStatus } } } }),
        stderr: "",
      };
    };

    const result = applyConfigCandidate({
      targetPath: target,
      candidatePath: candidate,
      codexExecutable: "codex.exe",
      spawn: runner,
      backupSuffix: "rollback-test",
    });

    assert.deepEqual(result, { ok: false, code: "CONFIG_ROLLED_BACK" });
    assert.equal(readFileSync(target, "utf8"), "[old]\nvalue = true\n");
    assert.equal(readFileSync(`${target}.rollback-test.bak`, "utf8"), "[old]\nvalue = true\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
