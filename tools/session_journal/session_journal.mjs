#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

function parseArgs(argv) {
  const args = { note: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--note") {
      args.note = argv[index + 1] || "";
      index += 1;
    }
  }
  return args;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return output || "(no output)";
}

function newestFiles(directory, limit = 8) {
  try {
    return readdirSync(directory)
      .map((name) => {
        const path = join(directory, name);
        return { name, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit)
      .map((file) => file.name);
  } catch {
    return [];
  }
}

function fence(text) {
  return ["```text", text, "```"].join("\n");
}

const args = parseArgs(process.argv.slice(2));
const now = new Date();
const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "-");
const outputDir = join(process.cwd(), "outputs", "session_journal");
const outputPath = join(outputDir, `${stamp}.md`);

mkdirSync(outputDir, { recursive: true });

const statePackets = newestFiles(join(process.cwd(), "outputs", "state_packets"));
const memoryInbox = newestFiles(join(process.cwd(), "outputs", "memory_inbox"));

const lines = [
  "# Session Journal Snapshot",
  "",
  `Created: ${now.toISOString()}`,
  `Workspace: ${process.cwd()}`,
  "",
  "## Scope",
  "",
  "This snapshot captures observable session state. It does not export hidden",
  "model reasoning, private chain-of-thought, secrets, raw memory dumps, or",
  "private backups.",
  "",
  "## Note",
  "",
  args.note || "(no note provided)",
  "",
  "## Git Status",
  "",
  fence(run("git", ["status", "-sb"])),
  "",
  "## Local Commits Ahead Of Origin",
  "",
  fence(run("git", ["log", "--oneline", "origin/main..HEAD"])),
  "",
  "## Recent Commits",
  "",
  fence(run("git", ["log", "--oneline", "-5"])),
  "",
  "## Recent State Packets",
  "",
  ...(statePackets.length ? statePackets.map((name) => `- ${name}`) : ["(none)"]),
  "",
  "## Recent Memory Inbox Drafts",
  "",
  ...(memoryInbox.length ? memoryInbox.map((name) => `- ${name}`) : ["(none)"]),
  "",
  "## Journal File",
  "",
  basename(outputPath),
  "",
];

writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(outputPath);
