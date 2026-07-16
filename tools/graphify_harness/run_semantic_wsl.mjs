#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function parseArgs(argv) {
  const options = { provider: "BOTHUB", tokenBudget: "8000" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--corpus") options.corpus = argv[++index];
    if (value === "--out") options.out = argv[++index];
    if (value === "--provider") options.provider = argv[++index].toUpperCase();
    if (value === "--token-budget") options.tokenBudget = argv[++index];
    if (value === "--check-env") options.checkEnv = true;
  }
  if (!options.checkEnv && (!options.corpus || !options.out)) {
    throw new Error("Usage: run_semantic_wsl.mjs --corpus <directory> --out <directory> [--provider BOTHUB] [--token-budget 8000]");
  }
  return options;
}

function toWslPath(value) {
  const normalized = path.resolve(value).replaceAll("\\", "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) throw new Error(`Expected an absolute Windows path, got: ${value}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function requiredEnvironment(provider) {
  const prefix = provider.toUpperCase();
  return [`${prefix}_API_KEY`, `${prefix}_BASE_URL`, `${prefix}_MODEL`];
}

function bashQuote(value) {
  return `'${String(value).replaceAll("'", "'\\\"'\\\"'")}'`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const required = requiredEnvironment(options.provider);
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(JSON.stringify({ status: "failed", reason: "missing-provider-environment", provider: options.provider, missing }));
    process.exit(2);
  }

  const bridgeEnv = {
    ...process.env,
    OPENAI_API_KEY: process.env[`${options.provider}_API_KEY`],
    OPENAI_BASE_URL: process.env[`${options.provider}_BASE_URL`],
    OPENAI_MODEL: process.env[`${options.provider}_MODEL`],
  };
  const forwarded = ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"];
  bridgeEnv.WSLENV = [...new Set([...(process.env.WSLENV || "").split(":"), ...forwarded.map((name) => `${name}/u`)].filter(Boolean))].join(":");

  // Semantic extraction is I/O-heavy. Keep its venv in Ubuntu's native file
  // system instead of the Windows-mounted workspace where pip can stall.
  const graphify = process.env.GRAPHIFY_WSL_EXE || "/home/poklad/.cache/theseus-graphify/venv/bin/graphify";
  const corpus = options.checkEnv ? "" : toWslPath(options.corpus);
  const out = options.checkEnv ? "" : toWslPath(options.out);
  if (!options.checkEnv && (!existsSync(options.corpus) || !existsSync(path.dirname(options.out)))) {
    console.error(JSON.stringify({ status: "failed", reason: "missing-local-path", corpus: options.corpus, out: options.out }));
    process.exit(2);
  }

  const command = options.checkEnv
    ? "node -e 'console.log(JSON.stringify({openai_key:Boolean(process.env.OPENAI_API_KEY),openai_base_url:Boolean(process.env.OPENAI_BASE_URL),openai_model:Boolean(process.env.OPENAI_MODEL)}))'"
    : `cd ${bashQuote(toWslPath(repoRoot))} && ${bashQuote(graphify)} extract ${bashQuote(corpus)} --backend openai --model \"$OPENAI_MODEL\" --token-budget ${bashQuote(options.tokenBudget)} --max-concurrency 1 --api-timeout 90 --out ${bashQuote(out)} --no-cluster`;
  const args = options.checkEnv
    ? ["bash", "-lc", command]
    : ["bash", "-lc", command];

  console.error(JSON.stringify({
    event: "graphify_semantic_start",
    provider: options.provider,
    corpus: options.checkEnv ? undefined : corpus,
    out: options.checkEnv ? undefined : out,
    token_budget: options.checkEnv ? undefined : Number(options.tokenBudget),
    max_concurrency: options.checkEnv ? undefined : 1,
  }));
  const child = spawn("wsl.exe", args, { cwd: repoRoot, env: bridgeEnv, stdio: "inherit", windowsHide: true });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
}

main();
