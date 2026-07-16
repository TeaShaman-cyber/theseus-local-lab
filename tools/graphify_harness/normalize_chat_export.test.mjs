import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const script = fileURLToPath(new URL("./normalize_chat_export.mjs", import.meta.url));

test("normalizes visible messages and separately labels user-provided reasoning traces", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "theseus-graphify-chat-"));
  const input = path.join(directory, "chat.json");
  const output = path.join(directory, "corpus.md");
  await writeFile(input, JSON.stringify({
    chat_messages: [
      { message_id: 1, role: "user", model: "test", inserted_at: 1, content: "visible request" },
      { message_id: 2, role: "assistant", model: "test", inserted_at: 2, content: "sk_abcdefghijklmnopqrst", thinking_content: "hidden reasoning" },
      { message_id: 3, role: "assistant", model: "test", inserted_at: 3, content: "" },
    ],
  }));
  await run(process.execPath, [script, "--input", input, "--out", output]);
  const corpus = await readFile(output, "utf8");
  assert.match(corpus, /visible request/);
  assert.match(corpus, /\[redacted-token\]/);
  assert.match(corpus, /reasoning_trace/);
  assert.match(corpus, /hidden reasoning/);
  assert.doesNotMatch(corpus, /thinking_content/);
});
