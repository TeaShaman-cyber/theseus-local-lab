#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG_FILENAME = "config.toml";

export function resolveCodexHome(env = process.env, platform = process.platform) {
  if (env.CODEX_HOME) return path.resolve(env.CODEX_HOME);
  const home = platform === "win32" ? env.USERPROFILE || env.HOME : env.HOME;
  if (!home) throw new Error("cannot resolve Codex home");
  return path.join(path.resolve(home), ".codex");
}

function parseJsonOutput(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function parseDoctorResult({ status, stdout = "", stderr = "", error } = {}) {
  if (error) return { ok: false, code: "CODEX_UNAVAILABLE" };
  const payload = parseJsonOutput(stdout);
  const parseStatus = payload?.checks?.["config.load"]?.details?.["config.toml parse"];
  if (parseStatus === "ok") return { ok: true, code: "CONFIG_OK" };
  if (parseStatus === "invalid" || /invalid configuration|config\.toml parse/i.test(`${stdout}\n${stderr}`)) {
    return { ok: false, code: "CONFIG_INVALID" };
  }
  if (status === null || status === undefined) return { ok: false, code: "CODEX_UNAVAILABLE" };
  return { ok: false, code: "CONFIG_INVALID" };
}

function runDoctor({ codexExecutable, codexHome, spawn = spawnSync } = {}) {
  let result;
  try {
    result = spawn(codexExecutable, ["--strict-config", "doctor", "--json"], {
      env: { ...process.env, CODEX_HOME: codexHome },
      encoding: "utf8",
      windowsHide: true,
    });
  } catch (error) {
    return parseDoctorResult({ error });
  }
  return parseDoctorResult(result);
}

export function validateConfigCandidate({ candidatePath, codexExecutable = process.platform === "win32" ? "codex.exe" : "codex", spawn = spawnSync } = {}) {
  if (!candidatePath || !existsSync(candidatePath)) return { ok: false, code: "CONFIG_MISSING" };

  let contents;
  try {
    contents = readFileSync(candidatePath, "utf8");
  } catch {
    return { ok: false, code: "CONFIG_INVALID" };
  }

  const isolatedHome = mkdtempSync(path.join(os.tmpdir(), "theseus-codex-config-preflight-"));
  try {
    writeFileSync(path.join(isolatedHome, CONFIG_FILENAME), contents, "utf8");
    return runDoctor({ codexExecutable, codexHome: isolatedHome, spawn });
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true });
  }
}

function backupSuffix(value) {
  if (value && /^[A-Za-z0-9._-]+$/.test(value)) return value;
  return `preflight-${Date.now()}`;
}

function restoreBackup({ targetPath, backupPath, targetExisted }) {
  if (targetExisted) copyFileSync(backupPath, targetPath);
  else if (existsSync(targetPath)) unlinkSync(targetPath);
}

export function applyConfigCandidate({
  candidatePath,
  targetPath = path.join(resolveCodexHome(), CONFIG_FILENAME),
  codexExecutable = process.platform === "win32" ? "codex.exe" : "codex",
  spawn = spawnSync,
  backupSuffix: requestedBackupSuffix,
} = {}) {
  const preflight = validateConfigCandidate({ candidatePath, codexExecutable, spawn });
  if (!preflight.ok) return { ok: false, code: "PREFLIGHT_FAILED" };

  const targetDirectory = path.dirname(targetPath);
  mkdirSync(targetDirectory, { recursive: true });
  const targetExisted = existsSync(targetPath);
  const backupPath = `${targetPath}.${backupSuffix(requestedBackupSuffix)}.bak`;
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    if (targetExisted) copyFileSync(targetPath, backupPath);
    copyFileSync(candidatePath, temporaryPath);
    copyFileSync(temporaryPath, targetPath);
    unlinkSync(temporaryPath);

    const postflight = validateConfigCandidate({ candidatePath: targetPath, codexExecutable, spawn });
    if (!postflight.ok) {
      restoreBackup({ targetPath, backupPath, targetExisted });
      return { ok: false, code: "CONFIG_ROLLED_BACK" };
    }
    return { ok: true, code: "CONFIG_APPLIED" };
  } catch {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    if (targetExisted && existsSync(backupPath)) restoreBackup({ targetPath, backupPath, targetExisted });
    else if (!targetExisted && existsSync(targetPath)) unlinkSync(targetPath);
    return { ok: false, code: "CONFIG_ROLLED_BACK" };
  }
}

function parseArgs(argv) {
  const args = { mode: null, candidatePath: null, targetPath: undefined, codexExecutable: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--check" || item === "--apply") args.mode = item.slice(2);
    else if (item === "--candidate") args.candidatePath = argv[++index];
    else if (item === "--target") args.targetPath = argv[++index];
    else if (item === "--codex") args.codexExecutable = argv[++index];
    else throw new Error("CONFIG_USAGE");
  }
  if (!args.mode || !args.candidatePath) throw new Error("CONFIG_USAGE");
  return args;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = args.mode === "check"
      ? validateConfigCandidate(args)
      : applyConfigCandidate(args);
    console.log(result.code);
    if (!result.ok) process.exitCode = 1;
  } catch {
    console.log("CONFIG_USAGE");
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main();
