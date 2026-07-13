import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const DEFAULT_SINK_URL = "http://127.0.0.1:8768/events";

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function localIso(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  const local = new Date(date.getTime() + offsetMinutes * 60_000).toISOString().replace("Z", "");
  return `${local}${sign}${hours}:${minutes}`;
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      if (Array.isArray(item) && item.length === 0) return false;
      if (typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) return false;
      return true;
    }),
  );
}

export function normalizeTimelineEvent(input = {}, now = new Date()) {
  return cleanObject({
    created_at: input.created_at || now.toISOString(),
    local_time: input.local_time || localIso(now),
    source: String(input.source || "manual").slice(0, 80),
    event: String(input.event || "note").slice(0, 120),
    note: String(input.note || "").slice(0, 4000),
    context_percent: input.context_percent,
    limit_percent_remaining: input.limit_percent_remaining,
    artifacts: asArray(input.artifacts || input.artifact).map((item) => String(item).slice(0, 500)),
    tags: asArray(input.tags || input.tag).map((item) => String(item).slice(0, 80)),
    metrics: input.metrics && typeof input.metrics === "object" ? input.metrics : {},
  });
}

export function timelinePath(workspace, now = new Date()) {
  return join(workspace, "outputs", "session_timeline", `${now.toISOString().slice(0, 10)}.jsonl`);
}

export async function mirrorTimelineEvent(event, sinkUrl) {
  if (!sinkUrl) return null;
  const response = await fetch(sinkUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`timeline sink failed: ${response.status} ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

function resolveSinkUrl(options = {}) {
  if (options.sinkUrl !== undefined) return options.sinkUrl;
  if (process.env.THESEUS_TIMELINE_DISABLE_SINK === "1") return "";
  return process.env.THESEUS_TIMELINE_URL || DEFAULT_SINK_URL;
}

function strictSink(options = {}) {
  if (options.strictSink !== undefined) return Boolean(options.strictSink);
  return process.env.THESEUS_TIMELINE_STRICT_SINK === "1";
}

export async function writeTimelineEvent(input = {}, options = {}) {
  const workspace = options.workspace || process.cwd();
  const now = options.now || new Date();
  const event = normalizeTimelineEvent(input, now);
  const path = options.path || timelinePath(workspace, now);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");

  const sinkUrl = resolveSinkUrl(options);
  let sink = null;
  if (sinkUrl) {
    try {
      sink = await mirrorTimelineEvent(event, sinkUrl);
    } catch (error) {
      sink = {
        ok: false,
        error: String(error?.message || error).slice(0, 500),
      };
      if (strictSink(options)) throw error;
    }
  }
  return { path, sink, event };
}
