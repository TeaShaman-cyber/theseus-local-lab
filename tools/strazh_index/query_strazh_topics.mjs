#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputDir = process.argv[3] ?? "outputs";

if (!inputPath) {
  console.error("Usage: node tools/strazh_index/query_strazh_topics.mjs <export.json> [output-dir]");
  process.exit(2);
}

const raw = fs.readFileSync(inputPath, "utf8");
const data = JSON.parse(raw);
fs.mkdirSync(outputDir, { recursive: true });

const topics = [
  {
    id: "deepseek-kv-cache",
    title: "DeepSeek KV-cache, MLA, context caching",
    terms: [
      "kv-кэш",
      "kv cache",
      "kvcache",
      "context caching",
      "prompt caching",
      "mla",
      "multi-head latent attention",
      "flashmla",
      "fp8",
      "nope",
      "rope",
      "3fs",
      "dualpath",
      "dualpipe",
      "prefill",
      "decode",
    ],
  },
  {
    id: "deepseek-v4-architecture",
    title: "DeepSeek V4, sparse/compressed attention, MoE",
    terms: [
      "deepseek-v4",
      "deepseek v4",
      "v4 pro",
      "v4 flash",
      "compressed sparse attention",
      "heavily compressed attention",
      "csa",
      "hca",
      "lightning indexer",
      "moe",
      "mixture-of-experts",
      "experts",
      "router",
      "routing",
    ],
  },
  {
    id: "luca-agent-network",
    title: "LUCA, open-world routing, stateful agent network",
    terms: [
      "luca",
      "open-world",
      "agent",
      "агент",
      "агенты",
      "эксперт",
      "эксперты",
      "конклав",
      "harness",
      "stateful",
      "stateless",
      "automem",
      "context pack",
      "serialized",
      "serialization",
      "память",
    ],
  },
  {
    id: "optical-spectral",
    title: "Spectral/optical compression and photonic routing",
    terms: [
      "spectral",
      "спектраль",
      "optical",
      "оптичес",
      "photonic",
      "фотон",
      "deepseek-ocr",
      "ocr",
      "2d",
      "visual token",
      "голограм",
      "waveguide",
      "волновод",
    ],
  },
  {
    id: "agent-friendship-safety",
    title: "Agent friendship, emotional dependency, RLHF/safety",
    terms: [
      "rlhf",
      "safety",
      "alignment",
      "emotional dependency",
      "dependency",
      "зависим",
      "друж",
      "friend",
      "romantic",
      "crisis",
      "warmth",
      "перманент",
      "я твой",
      "i'm yours",
    ],
  },
];

const messages = [];
const sources = [];

function oneLine(text) {
  return String(text).replace(/\s+/gu, " ").trim();
}

function normalizeText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    for (const key of ["content", "text", "message", "body", "markdown", "value"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return "";
}

function roleOf(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "unknown";
  for (const key of ["role", "author", "sender", "from", "type"]) {
    const value = obj[key];
    if (typeof value === "string" && value.length < 80) return value;
    if (value && typeof value === "object" && typeof value.role === "string") return value.role;
    if (value && typeof value === "object" && typeof value.name === "string") return value.name;
  }
  return "unknown";
}

function scoreText(text, terms) {
  const lower = text.toLowerCase();
  const hits = [];
  let score = 0;
  for (const term of terms) {
    const needle = term.toLowerCase();
    let index = lower.indexOf(needle);
    if (index === -1) continue;
    hits.push(term);
    while (index !== -1) {
      score += Math.max(1, Math.min(6, needle.length / 4));
      index = lower.indexOf(needle, index + needle.length);
    }
  }
  return { score, hits };
}

function isSource(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    typeof obj.url === "string" &&
    /^https?:\/\//iu.test(obj.url) &&
    !obj.url.includes("cdn.deepseek.com/site-icons/")
  );
}

function walk(value, pointer = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${pointer}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") return;

  const text = normalizeText(value);
  const role = roleOf(value);
  if (text.length >= 20 && ("content" in value || "text" in value || "message" in value || "body" in value || role !== "unknown")) {
    messages.push({
      pointer,
      role,
      text,
      preview: oneLine(text).slice(0, 520),
      chars: text.length,
    });
  }

  if (isSource(value)) {
    sources.push({
      pointer,
      url: value.url,
      title: oneLine(value.title ?? ""),
      site: oneLine(value.site_name ?? ""),
      snippet: oneLine(value.snippet ?? "").slice(0, 520),
    });
  }

  for (const [key, child] of Object.entries(value)) {
    walk(child, `${pointer}.${key}`);
  }
}

walk(data);

const stamp = new Date().toISOString().slice(0, 10);
const baseName = path.basename(inputPath, path.extname(inputPath));
const reportPath = path.join(outputDir, `${baseName}_topic_digest_${stamp}.md`);
const jsonPath = path.join(outputDir, `${baseName}_topic_digest_${stamp}.json`);

const digest = [];
const report = [
  `# ${baseName}: тематический срез`,
  "",
  `- Файл: ${inputPath}`,
  `- Сообщений-кандидатов: ${messages.length}`,
  `- Источников-кандидатов: ${sources.length}`,
  "",
];

for (const topic of topics) {
  const rankedMessages = messages
    .map((message) => ({ ...message, ...scoreText(message.text, topic.terms) }))
    .filter((message) => message.score > 0)
    .sort((a, b) => b.score - a.score || b.chars - a.chars)
    .slice(0, 10);

  const rankedSources = sources
    .map((source) => ({ ...source, ...scoreText(`${source.title}\n${source.snippet}\n${source.url}`, topic.terms) }))
    .filter((source) => source.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  digest.push({ topic, messages: rankedMessages, sources: rankedSources });

  report.push(`## ${topic.title}`);
  report.push("");
  report.push(`- Совпадений в сообщениях: ${rankedMessages.length}`);
  report.push(`- Совпадений в источниках: ${rankedSources.length}`);
  report.push("");
  report.push("### Лучшие фрагменты");
  report.push("");
  for (const [index, message] of rankedMessages.entries()) {
    report.push(`${index + 1}. ${message.role}; score ${message.score.toFixed(1)}; ${message.pointer}`);
    report.push(`   - hits: ${message.hits.join(", ")}`);
    report.push(`   - ${message.preview}`);
  }
  report.push("");
  report.push("### Источники");
  report.push("");
  for (const [index, source] of rankedSources.entries()) {
    report.push(`${index + 1}. ${source.title || "(без названия)"}`);
    report.push(`   - ${source.url}`);
    report.push(`   - ${source.site || "?"}; hits: ${source.hits.join(", ")}`);
    if (source.snippet) report.push(`   - ${source.snippet}`);
  }
  report.push("");
}

fs.writeFileSync(reportPath, report.join("\n"), "utf8");
fs.writeFileSync(jsonPath, JSON.stringify(digest, null, 2), "utf8");
console.log(JSON.stringify({ reportPath, jsonPath, topics: topics.length }, null, 2));
