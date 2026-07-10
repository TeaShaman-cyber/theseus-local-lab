#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_COMMAND = "copilot";
const DEFAULT_ARGS = "-p {prompt}";

function readStdin() {
  try {
    if (process.stdin.isTTY) return "";
    return readFileSync(0, "utf8").trim();
  } catch {
    return "";
  }
}

function splitArgs(template, prompt) {
  const result = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < template.length; index += 1) {
    const char = template[index];
    if ((char === "\"" || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (char === " " && !quote) {
      if (current) {
        result.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) result.push(current);
  return result.map((arg) => arg.replaceAll("{prompt}", prompt));
}

const prompt = process.argv.slice(2).join(" ").trim() || readStdin();

if (!prompt) {
  console.error("Usage: node tools/copilot_advisor/copilot_advisor.mjs <prompt>");
  process.exit(2);
}

console.error("Copilot advisor bridge");
console.error("- Send only explicit, non-secret prompts.");
console.error("- Do not paste .env, keys, raw memory exports, or private backups.");

const command =
  process.env.COPILOT_ADVISOR_COMMAND ||
  (process.platform === "win32" ? "copilot.cmd" : DEFAULT_COMMAND);
const argsTemplate = process.env.COPILOT_ADVISOR_ARGS || DEFAULT_ARGS;
const args = splitArgs(argsTemplate, prompt);
const childEnv = { ...process.env };

if (process.env.COPILOT_ADVISOR_PROXY) {
  childEnv.HTTP_PROXY ||= process.env.COPILOT_ADVISOR_PROXY;
  childEnv.HTTPS_PROXY ||= process.env.COPILOT_ADVISOR_PROXY;
}

function quoteForPowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

let result;

if (
  process.platform === "win32" &&
  !process.env.COPILOT_ADVISOR_COMMAND &&
  !process.env.COPILOT_ADVISOR_ARGS
) {
  const npmCopilot = join(process.env.APPDATA || "", "npm", "copilot.cmd");
  const copilotCommand = process.env.APPDATA ? npmCopilot : "copilot.cmd";
  const commandLine = `& ${quoteForPowerShell(copilotCommand)} -p ${quoteForPowerShell(prompt)}`;
  result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", commandLine],
    {
      encoding: "utf8",
      env: childEnv,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
} else {
  result = spawnSync(command, args, {
    encoding: "utf8",
    env: childEnv,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

if (result.error) {
  console.error("");
  console.error(`Could not start '${command}'.`);
  console.error("Install or expose a Copilot CLI, then rerun this advisor task.");
  console.error("");
  console.error("Optional configuration:");
  console.error("  COPILOT_ADVISOR_COMMAND=<command>");
  console.error("  COPILOT_ADVISOR_ARGS=<args with {prompt}>");
  process.exit(127);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 0);
