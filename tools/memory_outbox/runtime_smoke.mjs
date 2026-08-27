#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = await mkdtemp(join(process.env.TEMP || process.env.TMP || ".", "theseus-memory-smoke-"));
const transcript = join(dir, "rollout.jsonl");
const input = JSON.stringify({
  session_id: `memory-smoke-${Date.now()}`,
  transcript_path: transcript,
});

try {
  await writeFile(
    transcript,
    `${JSON.stringify({
      payload: {
        role: "assistant",
        content: "Decision: runtime memory smoke verifies the transcript gate without provider writes.",
      },
    })}\n`,
  );

  const output = execFileSync(process.execPath, ["tools/memory_gate/memory_gate.mjs"], {
    cwd: root,
    encoding: "utf8",
    input,
    timeout: 5000,
    env: {
      ...process.env,
      AUTOMEM_API_URL: "",
      AUTOMEM_API_TOKEN: "",
      MEMPALACE_MCP_URL: "",
      HINDSIGHT_API_URL: "",
    },
  });
  const gate = JSON.parse(output);
  if (!gate.accept) throw new Error("memory gate rejected the smoke fixture");

  process.stdout.write(JSON.stringify({
    safe: true,
    gate_accept: true,
    provider_writes: false,
    outbox_writes: false,
    event_id: gate.event_id,
  }));
} finally {
  await rm(dir, { recursive: true, force: true });
}
