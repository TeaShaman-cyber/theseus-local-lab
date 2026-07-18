#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const toolPath = path.join(here, "relink_thread_workspace.mjs");

const liveCodexHome = "/mnt/c/Users/s.poklad/.codex";
const threadId = "019f4194-f804-7d70-bf1f-c74e74f7781f";
const newCwd = "/home/poklad/theseus-local-lab";
const newWorkspaceRoot = "\\\\wsl.localhost\\Ubuntu-24.04\\home\\poklad\\theseus-local-lab";

function copyIfExists(source, target) {
  if (!existsSync(source)) return;
  copyFileSync(source, target);
}

function sqliteJson(sqlitePath, sql) {
  const result = spawnSync("sqlite3", ["-json", sqlitePath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim() ? JSON.parse(result.stdout) : [];
}

function runTool(codexHome, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [
      toolPath,
      "--codex-home",
      codexHome,
      "--thread",
      threadId,
      "--new-cwd",
      newCwd,
      "--new-workspace-root",
      newWorkspaceRoot,
      ...extraArgs,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function makeCodexClone() {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "theseus-codex-relink-"));
  const codexHome = path.join(tempRoot, ".codex");
  mkdirSync(codexHome, { recursive: true });
  copyIfExists(path.join(liveCodexHome, "state_5.sqlite"), path.join(codexHome, "state_5.sqlite"));
  copyIfExists(path.join(liveCodexHome, "state_5.sqlite-wal"), path.join(codexHome, "state_5.sqlite-wal"));
  copyIfExists(path.join(liveCodexHome, "state_5.sqlite-shm"), path.join(codexHome, "state_5.sqlite-shm"));
  copyIfExists(path.join(liveCodexHome, ".codex-global-state.json"), path.join(codexHome, ".codex-global-state.json"));
  copyIfExists(path.join(liveCodexHome, "config.toml"), path.join(codexHome, "config.toml"));
  return { tempRoot, codexHome };
}

test("dry-run reports intended rebind without mutating clone", () => {
  const { tempRoot, codexHome } = makeCodexClone();
  try {
    const sqlitePath = path.join(codexHome, "state_5.sqlite");
    const before = sqliteJson(sqlitePath, `select cwd from threads where id = '${threadId}' limit 1;`)[0].cwd;
    const result = runTool(codexHome, ["--dry-run"]);
    const after = sqliteJson(sqlitePath, `select cwd from threads where id = '${threadId}' limit 1;`)[0].cwd;

    assert.equal(result.mode, "dry-run");
    assert.equal(result.thread_id, threadId);
    assert.equal(result.changes.sqlite.to, newCwd);
    assert.equal(after, before);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("apply changes only cloned Codex metadata and verifies fields", () => {
  const { tempRoot, codexHome } = makeCodexClone();
  try {
    const result = runTool(codexHome, ["--apply", "--codex-closed"]);
    const sqlitePath = path.join(codexHome, "state_5.sqlite");
    const row = sqliteJson(sqlitePath, `select cwd from threads where id = '${threadId}' limit 1;`)[0];
    const globalState = JSON.parse(readFileSync(path.join(codexHome, ".codex-global-state.json"), "utf8"));

    assert.equal(result.mode, "apply");
    assert.equal(row.cwd, newCwd);
    assert.equal(globalState["thread-workspace-root-hints"][threadId], newWorkspaceRoot);
    assert.equal(globalState["thread-projectless-output-directories"]?.[threadId], undefined);
    assert.equal((globalState["projectless-thread-ids"] || []).includes(threadId), false);
    assert.equal(globalState["electron-saved-workspace-roots"].includes(newWorkspaceRoot), true);
    assert.equal(globalState["active-workspace-roots"].includes(newWorkspaceRoot), true);
    assert.equal(result.apply.verify.sqlite_cwd_ok, true);
    assert.equal(result.apply.verify.workspace_hint_ok, true);
    assert.equal(result.apply.verify.projectless_removed, true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
