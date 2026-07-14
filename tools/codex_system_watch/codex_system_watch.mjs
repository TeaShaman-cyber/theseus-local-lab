#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, exit } from "node:process";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, "outputs", "codex_system_watch");
const DEFAULT_TERMS = ["codex", "chatgpt", "openai", "node_repl", "codexsandbox", "wsl", "docker desktop"];

function parseArgs(argv) {
  const args = {
    eventCount: 160,
    sinceHours: 72,
    outputDir: DEFAULT_OUTPUT_DIR,
    write: false,
    format: "markdown",
    terms: DEFAULT_TERMS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--event-count") args.eventCount = Number(argv[++i] || args.eventCount);
    else if (item === "--since-hours") args.sinceHours = Number(argv[++i] || args.sinceHours);
    else if (item === "--output-dir") args.outputDir = path.resolve(argv[++i] || args.outputDir);
    else if (item === "--terms") args.terms = String(argv[++i] || "").split(",").map((term) => term.trim()).filter(Boolean);
    else if (item === "--write") args.write = true;
    else if (item === "--json") args.format = "json";
    else if (item === "--markdown") args.format = "markdown";
  }

  args.eventCount = Math.max(1, Math.min(500, Number.isFinite(args.eventCount) ? args.eventCount : 160));
  args.sinceHours = Math.max(1, Number.isFinite(args.sinceHours) ? args.sinceHours : 72);
  return args;
}

function decodeOutput(buffer) {
  if (!buffer?.length) return "";
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  const sample = buffer.subarray(0, Math.min(buffer.length, 200));
  let zeroOdd = 0;
  for (let i = 1; i < sample.length; i += 2) {
    if (sample[i] === 0) zeroOdd += 1;
  }
  if (zeroOdd > sample.length / 6) return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd || repoRoot,
        env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ ok: false, code: null, killed: false, stdout: "", stderr: `${command}: ${error.message}` });
      return;
    }
    const stdout = [];
    const stderr = [];
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, options.timeoutMs || 15_000);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, killed, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !killed,
        code,
        killed,
        stdout: decodeOutput(Buffer.concat(stdout)),
        stderr: decodeOutput(Buffer.concat(stderr)),
      });
    });
  });
}

function xmlDecode(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function attr(xml, name) {
  const match = xml.match(new RegExp(`${name}=['"]([^'"]*)['"]`, "i"));
  return match ? xmlDecode(match[1]) : "";
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? xmlDecode(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "";
}

function eventsFromXml(xml) {
  return [...String(xml || "").matchAll(/<Event\b[\s\S]*?<\/Event>/gi)].map((match) => match[0]);
}

function parseEvent(xml) {
  const providerMatch = xml.match(/<Provider\b[^>]*>/i);
  const timeMatch = xml.match(/<TimeCreated\b[^>]*>/i);
  const executionMatch = xml.match(/<Execution\b[^>]*>/i);
  const eventData = tag(xml, "EventData") || tag(xml, "UserData");
  return {
    provider: providerMatch ? attr(providerMatch[0], "Name") : "",
    event_id: tag(xml, "EventID"),
    level: tag(xml, "Level"),
    time_created: timeMatch ? attr(timeMatch[0], "SystemTime") : "",
    record_id: tag(xml, "EventRecordID"),
    process_id: executionMatch ? attr(executionMatch[0], "ProcessID") : "",
    channel: tag(xml, "Channel"),
    message_excerpt: eventData.slice(0, 700),
  };
}

function eventText(event) {
  return `${event.provider} ${event.event_id} ${event.channel} ${event.message_excerpt}`.toLowerCase();
}

function eventTags(event) {
  const text = eventText(event);
  return [
    ["codex", /codex|codexsandbox/i],
    ["chatgpt", /chatgpt/i],
    ["openai", /openai/i],
    ["wsl", /\bwsl\b|ubuntu|linux/i],
    ["docker", /docker/i],
    ["node", /node|node_repl/i],
    ["crash", /fault|crash|hang|exception|error|fail|deadlock|stopped working/i],
    ["network", /proxy|timeout|connection|websocket|localhost|nat/i],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function compactEvents(events) {
  const byKey = new Map();
  for (const event of events) {
    const key = `${event.provider}|${event.event_id}|${event.level}|${event.message_excerpt}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (String(event.time_created || "") > String(existing.time_created || "")) {
        existing.time_created = event.time_created;
        existing.record_id = event.record_id;
      }
    } else {
      byKey.set(key, { ...event, occurrences: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => String(b.time_created || "").localeCompare(String(a.time_created || "")));
}

function isRecent(event, now, sinceHours) {
  const ts = Date.parse(event.time_created || "");
  if (!Number.isFinite(ts)) return true;
  return now.getTime() - ts <= sinceHours * 3_600_000;
}

function matchesTerms(event, terms) {
  const text = eventText(event);
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function desktopVersionsFromPaths(paths) {
  return [...new Set(paths.map((item) => item.match(/OpenAI\.(?:Codex|ChatGPT)_([^\\]+?)_/i)?.[1]).filter(Boolean))];
}

async function collectVersions() {
  const whereCodex = await run("where.exe", ["codex"], { timeoutMs: 10_000 });
  const paths = whereCodex.ok ? whereCodex.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  const executable = paths.find((item) => /\.exe$/i.test(item)) || paths.find((item) => /\.cmd$/i.test(item)) || "codex";
  let codexVersion = await run(executable, ["--version"], { timeoutMs: 10_000 });
  const cmdShim = paths.find((item) => /\.cmd$/i.test(item));
  if (!codexVersion.ok && cmdShim) {
    codexVersion = await run("cmd.exe", ["/d", "/c", cmdShim, "--version"], { timeoutMs: 10_000 });
  }
  return {
    codex_cli: {
      ok: codexVersion.ok,
      version: codexVersion.stdout.trim() || null,
      error: codexVersion.ok ? null : (codexVersion.stderr || "codex --version failed"),
    },
    discovered_paths: paths,
    desktop_app: {
      versions_from_windowsapps: desktopVersionsFromPaths(paths),
      windowsapps_paths: paths.filter((item) => /WindowsApps/i.test(item)),
    },
  };
}

async function collectEvents(args) {
  const result = await run(
    "wevtutil",
    [
      "qe",
      "Application",
      "/q:*\u005bSystem\u005b(Level=1 or Level=2 or Level=3)\u005d\u005d",
      `/c:${args.eventCount}`,
      "/rd:true",
      "/f:xml",
      "/uni:true",
    ],
    { timeoutMs: 20_000 },
  );
  if (!result.ok) {
    return {
      ok: false,
      error: result.stderr || result.stdout || "wevtutil failed",
      sampled: 0,
      matched: 0,
      events: [],
    };
  }

  const now = new Date();
  const sampled = eventsFromXml(result.stdout).map(parseEvent);
  const matchedRaw = sampled
    .filter((event) => isRecent(event, now, args.sinceHours))
    .filter((event) => matchesTerms(event, args.terms))
    .map((event) => ({ ...event, tags: eventTags(event) }))
    .slice(0, 40);
  const matched = compactEvents(matchedRaw);

  const providers = new Map();
  const tags = new Map();
  for (const event of matchedRaw) {
    providers.set(event.provider || "unknown", (providers.get(event.provider || "unknown") || 0) + 1);
    for (const item of event.tags) tags.set(item, (tags.get(item) || 0) + 1);
  }

  return {
    ok: true,
    channel: "Application",
    sampled: sampled.length,
    matched: matchedRaw.length,
    unique_matched: matched.length,
    window_hours: args.sinceHours,
    providers: [...providers.entries()].sort((a, b) => b[1] - a[1]).map(([provider, count]) => ({ provider, count })),
    tags: [...tags.entries()].sort((a, b) => b[1] - a[1]).map(([tagName, count]) => ({ tag: tagName, count })),
    events: matched,
  };
}

async function collect(args) {
  const [versions, windows_events] = await Promise.all([collectVersions(), collectEvents(args)]);
  return {
    generated_at: new Date().toISOString(),
    source: "local-windows-host",
    collection: {
      codex_version: "codex --version and where.exe codex",
      windows_events: "wevtutil qe Application errors/warnings",
      terms: args.terms,
    },
    versions,
    windows_events,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Local System Watch",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "## Version",
    "",
    `- Codex CLI: ${report.versions.codex_cli.version || "unknown"}`,
    `- Desktop versions from WindowsApps path: ${report.versions.desktop_app.versions_from_windowsapps.join(", ") || "unknown"}`,
    `- Discovered paths: ${report.versions.discovered_paths.length}`,
    "",
    "## Windows Event Log",
    "",
  ];
  const events = report.windows_events;
  if (!events.ok) {
    lines.push(`- Event collection failed: ${events.error}`);
  } else {
    lines.push(`- Channel: ${events.channel}`);
    lines.push(`- Sampled: ${events.sampled}`);
    lines.push(`- Matched: ${events.matched}`);
    lines.push(`- Unique matched: ${events.unique_matched}`);
    lines.push(`- Window: ${events.window_hours}h`);
    lines.push("");
    lines.push("### Providers");
    lines.push("");
    if (events.providers.length === 0) lines.push("- none");
    for (const item of events.providers) lines.push(`- ${item.provider}: ${item.count}`);
    lines.push("");
    lines.push("### Recent Matched Events");
    lines.push("");
    if (events.events.length === 0) lines.push("- none");
    for (const event of events.events.slice(0, 12)) {
      lines.push(
        `- ${event.time_created || "unknown time"} ${event.provider || "unknown provider"} #${event.event_id || "?"} x${event.occurrences || 1} (${event.tags.join(", ") || "untagged"})`,
        `  ${event.message_excerpt.replace(/\s+/g, " ").slice(0, 220)}`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function writeOutputs(report, markdown, outputDir) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "codex-system.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "codex-system.md"), markdown, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await collect(args);
  const markdown = renderMarkdown(report);
  if (args.write) await writeOutputs(report, markdown, args.outputDir);
  if (args.format === "json") console.log(JSON.stringify(report, null, 2));
  else console.log(markdown);
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
