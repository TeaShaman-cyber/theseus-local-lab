#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { normalizeTimelineEvent, writeTimelineEvent } from "./event_writer.mjs";

test("normalizes compact timeline events", () => {
  const event = normalizeTimelineEvent(
    {
      source: "codex",
      event: "tool-call-result",
      note: "ok",
      tag: ["smoke", "timeline"],
      artifact: "outputs/report.md",
      metrics: { ok: 1 },
    },
    new Date("2026-07-13T00:00:00.000Z"),
  );

  assert.equal(event.source, "codex");
  assert.equal(event.event, "tool-call-result");
  assert.deepEqual(event.tags, ["smoke", "timeline"]);
  assert.deepEqual(event.artifacts, ["outputs/report.md"]);
  assert.equal(event.metrics.ok, 1);
});

test("writes JSONL without requiring a sink", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "theseus-timeline-test-"));
  const result = await writeTimelineEvent(
    {
      source: "test",
      event: "writer-test",
      note: "timeline writer test",
      tags: ["test"],
    },
    {
      workspace,
      now: new Date("2026-07-13T00:00:00.000Z"),
      sinkUrl: "",
    },
  );

  const text = await readFile(result.path, "utf8");
  const event = JSON.parse(text.trim());
  assert.equal(event.source, "test");
  assert.equal(event.event, "writer-test");
  assert.equal(result.sink, null);
});

test("default sink failures are fail-soft", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "theseus-timeline-test-"));
  const result = await writeTimelineEvent(
    {
      source: "test",
      event: "writer-fail-soft",
      note: "sink unavailable should not break local write",
    },
    {
      workspace,
      now: new Date("2026-07-13T00:00:00.000Z"),
      sinkUrl: "http://127.0.0.1:1/events",
    },
  );

  const text = await readFile(result.path, "utf8");
  assert.match(text, /writer-fail-soft/);
  assert.equal(result.sink.ok, false);
  assert.match(result.sink.error, /fetch|failed|bad port/i);
});

test("strict sink mode surfaces mirror errors", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "theseus-timeline-test-"));
  await assert.rejects(
    writeTimelineEvent(
      {
        source: "test",
        event: "writer-strict-failure",
        note: "strict sink should fail",
      },
      {
        workspace,
        sinkUrl: "http://127.0.0.1:1/events",
        strictSink: true,
      },
    ),
  );
});
