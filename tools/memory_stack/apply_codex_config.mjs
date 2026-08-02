import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const configPath = process.argv[2] || path.join(os.homedir(), ".codex", "config.toml");
const automemEntrypoint = path.join(
  repoRoot,
  "work",
  "mcp-automem-bridge",
  "node_modules",
  "@verygoodplugins",
  "mcp-automem",
  "dist",
  "index.js",
);
const automemApiUrl = process.env.THESEUS_AUTOMEM_API_URL || "http://127.0.0.1:8001";
const automemApiKey = "test-token";
const mempalaceImage = process.env.THESEUS_MEMPALACE_IMAGE || "theseus-mempalace:pilot";
const mempalaceVolume = process.env.THESEUS_MEMPALACE_VOLUME || "theseus-mempalace-clean:/data";
const includeMempalace = process.argv.includes("--include-mempalace");

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function findSection(lines, header) {
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\[.+\]\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function setKey(lines, section, key, value) {
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = section.start + 1; i < section.end; i += 1) {
    if (pattern.test(lines[i])) {
      if (lines[i] !== `${key} = ${value}`) {
        lines[i] = `${key} = ${value}`;
      }
      return;
    }
  }
  lines.splice(section.end, 0, `${key} = ${value}`);
  section.end += 1;
}

function ensureSection(lines, header, bodyLines) {
  let section = findSection(lines, header);
  if (!section) {
    if (lines.length && lines.at(-1).trim() !== "") lines.push("");
    lines.push(header, ...bodyLines);
    return { start: lines.length - bodyLines.length - 1, end: lines.length };
  }
  for (const bodyLine of bodyLines) {
    const key = bodyLine.split("=")[0].trim();
    setKey(lines, section, key, bodyLine.split("=").slice(1).join("=").trim());
  }
  return findSection(lines, header);
}

if (!fs.existsSync(configPath)) {
  throw new Error(`Codex config not found: ${configPath}`);
}
if (!fs.existsSync(automemEntrypoint)) {
  throw new Error(`AutoMem MCP entrypoint not found: ${automemEntrypoint}`);
}

const before = fs.readFileSync(configPath, "utf8");
const lines = before.replace(/\r\n/g, "\n").split("\n");

ensureSection(lines, "[mcp_servers.memory]", [
  "command = 'node'",
  `args = [${quote(automemEntrypoint)}]`,
  "enabled = true",
  "startup_timeout_sec = 30",
  "tool_timeout_sec = 90",
]);

ensureSection(lines, "[mcp_servers.memory.env]", [
  `AUTOMEM_API_URL = ${quote(automemApiUrl)}`,
  `AUTOMEM_API_KEY = ${quote(automemApiKey)}`,
]);

if (includeMempalace) {
  ensureSection(lines, "[mcp_servers.mempalace]", [
    "command = 'docker.exe'",
    `args = ['run', '-i', '--rm', '-v', ${quote(mempalaceVolume)}, ${quote(mempalaceImage)}]`,
    "enabled = true",
    "startup_timeout_sec = 60",
    "tool_timeout_sec = 120",
  ]);
}

const after = lines.join("\n").replace(/\n{3,}/g, "\n\n");
if (after === before) {
  console.log("Codex MCP memory config already up to date.");
  process.exit(0);
}

const backupPath = `${configPath}.bak-${timestamp()}`;
fs.copyFileSync(configPath, backupPath);
fs.writeFileSync(configPath, after, "utf8");

console.log("Updated Codex AutoMem MCP config.");
console.log(`Backup: ${backupPath}`);
console.log(`Config: ${configPath}`);
console.log(`AutoMem endpoint: ${automemApiUrl}`);
console.log("AutoMem local test auth: enabled");
console.log(`MemPalace included: ${includeMempalace}`);
console.log(`Repo: ${repoRoot}`);
