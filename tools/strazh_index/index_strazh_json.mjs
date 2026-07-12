#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputDir = process.argv[3] ?? "outputs";

if (!inputPath) {
  console.error("Usage: node tools/strazh_index/index_strazh_json.mjs <export.json> [output-dir]");
  process.exit(2);
}

const raw = fs.readFileSync(inputPath, "utf8");
const data = JSON.parse(raw);

const now = new Date();
const stamp = now.toISOString().slice(0, 10);
const baseName = path.basename(inputPath, path.extname(inputPath));
fs.mkdirSync(outputDir, { recursive: true });

const urlRe = /\bhttps?:\/\/[^\s<>"')\]}]+/giu;
const messages = [];
const urls = new Map();
const searchSources = new Map();
const topLevel = describeValue(data);
const keyCounts = new Map();
const roleCounts = new Map();
const wordCounts = new Map();

function describeValue(value) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value === null) return "null";
  if (typeof value === "object") return `object(${Object.keys(value).length})`;
  return typeof value;
}

function addCount(map, key, inc = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + inc);
}

function normalizeText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const preferred = ["content", "text", "message", "body", "markdown", "value"];
    for (const key of preferred) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return "";
}

function detectRole(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
  const roleKeys = ["role", "author", "sender", "from", "type"];
  for (const key of roleKeys) {
    const value = obj[key];
    if (typeof value === "string" && value.length < 80) return value;
    if (value && typeof value === "object" && typeof value.role === "string") return value.role;
    if (value && typeof value === "object" && typeof value.name === "string") return value.name;
  }
  return "";
}

function maybeMessage(obj, pointer) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  const text = normalizeText(obj);
  if (!text || text.length < 20) return;
  const role = detectRole(obj);
  const hasMessageShape =
    "content" in obj ||
    "text" in obj ||
    "message" in obj ||
    "body" in obj ||
    role;
  if (!hasMessageShape) return;
  messages.push({
    pointer,
    role: role || "unknown",
    chars: text.length,
    preview: oneLine(text).slice(0, 260),
    text,
  });
  addCount(roleCounts, role || "unknown");
}

function maybeSearchSource(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  if (typeof obj.url !== "string") return;
  const url = obj.url.trim();
  if (!/^https?:\/\//iu.test(url)) return;
  if (url.includes("cdn.deepseek.com/site-icons/")) return;

  const current = searchSources.get(url) ?? {
    url,
    count: 0,
    title: "",
    site_name: "",
    published_at: "",
    snippets: [],
  };
  current.count += 1;
  if (!current.title && typeof obj.title === "string") current.title = oneLine(obj.title);
  if (!current.site_name && typeof obj.site_name === "string") current.site_name = oneLine(obj.site_name);
  if (!current.published_at && typeof obj.published_at === "string") current.published_at = oneLine(obj.published_at);
  if (typeof obj.snippet === "string" && current.snippets.length < 3) {
    current.snippets.push(oneLine(obj.snippet).slice(0, 360));
  }
  searchSources.set(url, current);
}

function oneLine(text) {
  return text.replace(/\s+/gu, " ").trim();
}

function collectWords(text) {
  const words = text
    .toLowerCase()
    .match(/[\p{L}\p{N}_-]{4,}/gu);
  if (!words) return;
  const stop = new Set([
    "что",
    "это",
    "как",
    "для",
    "если",
    "или",
    "the",
    "and",
    "with",
    "from",
    "this",
    "that",
    "https",
    "http",
  ]);
  for (const word of words) {
    if (!stop.has(word)) addCount(wordCounts, word);
  }
}

function walk(value, pointer = "$") {
  if (typeof value === "string") {
    collectWords(value);
    for (const match of value.matchAll(urlRe)) {
      const url = match[0].replace(/[.,;:]+$/u, "");
      const current = urls.get(url) ?? { url, count: 0, examples: [] };
      current.count += 1;
      if (current.examples.length < 3) {
        const start = Math.max(0, match.index - 100);
        const end = Math.min(value.length, match.index + url.length + 100);
        current.examples.push(oneLine(value.slice(start, end)));
      }
      urls.set(url, current);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${pointer}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    maybeMessage(value, pointer);
    maybeSearchSource(value);
    for (const [key, child] of Object.entries(value)) {
      addCount(keyCounts, key);
      walk(child, `${pointer}.${key}`);
    }
  }
}

walk(data);

const sortedUrls = [...urls.values()].sort((a, b) => b.count - a.count || a.url.localeCompare(b.url));
const sortedSources = [...searchSources.values()].sort((a, b) => b.count - a.count || a.url.localeCompare(b.url));
const topKeys = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
const topWords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
const topRoles = [...roleCounts.entries()].sort((a, b) => b[1] - a[1]);
const biggestMessages = [...messages].sort((a, b) => b.chars - a.chars).slice(0, 20);

const reportPath = path.join(outputDir, `${baseName}_index_${stamp}.md`);
const urlPath = path.join(outputDir, `${baseName}_urls_${stamp}.json`);
const sourcesPath = path.join(outputDir, `${baseName}_sources_${stamp}.json`);

const report = [
  `# ${baseName}: индекс выгрузки`,
  "",
  `- Файл: ${inputPath}`,
  `- Размер: ${raw.length.toLocaleString("ru-RU")} символов`,
  `- Верхний уровень: ${topLevel}`,
  `- Найдено сообщений: ${messages.length}`,
  `- Найдено уникальных URL: ${sortedUrls.length}`,
  `- Найдено поисковых источников: ${sortedSources.length}`,
  "",
  "## Роли",
  "",
  ...topRoles.map(([role, count]) => `- ${role}: ${count}`),
  "",
  "## Частые ключи JSON",
  "",
  ...topKeys.map(([key, count]) => `- ${key}: ${count}`),
  "",
  "## Частые термины",
  "",
  topWords.map(([word, count]) => `${word} (${count})`).join(", "),
  "",
  "## Ссылки",
  "",
  ...sortedUrls.slice(0, 120).flatMap((entry, index) => [
    `${index + 1}. ${entry.url} (${entry.count})`,
    ...entry.examples.slice(0, 1).map((example) => `   - Контекст: ${example.slice(0, 280)}`),
  ]),
  "",
  "## Поисковые источники DeepSeek",
  "",
  ...sortedSources.slice(0, 120).flatMap((entry, index) => [
    `${index + 1}. ${entry.title || "(без названия)"}`,
    `   - URL: ${entry.url}`,
    `   - Сайт: ${entry.site_name || "?"}; упоминаний: ${entry.count}; дата: ${entry.published_at || "?"}`,
    ...entry.snippets.slice(0, 1).map((snippet) => `   - Snippet: ${snippet}`),
  ]),
  "",
  "## Самые длинные сообщения",
  "",
  ...biggestMessages.flatMap((message, index) => [
    `${index + 1}. ${message.role}, ${message.chars} символов, ${message.pointer}`,
    `   - ${message.preview}`,
  ]),
  "",
].join("\n");

fs.writeFileSync(reportPath, report, "utf8");
fs.writeFileSync(urlPath, JSON.stringify(sortedUrls, null, 2), "utf8");
fs.writeFileSync(sourcesPath, JSON.stringify(sortedSources, null, 2), "utf8");

console.log(JSON.stringify({
  reportPath,
  urlPath,
  sourcesPath,
  messages: messages.length,
  urls: sortedUrls.length,
  sources: sortedSources.length,
  roles: Object.fromEntries(topRoles),
}, null, 2));
