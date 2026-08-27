import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const event = {
  accept: true,
  episodic: true,
  event_id: "mempalace-event-1",
  content: "Decision: verify MemPalace receipt.",
};

async function createFakeMcporter(dir) {
  const script = join(dir, "fake-mcporter.mjs");
  await writeFile(script, `
import { appendFile, readFile } from "node:fs/promises";
const target = process.argv[3] || "";
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw);
if (process.env.FAKE_MEMPALACE_LOG) {
  await appendFile(process.env.FAKE_MEMPALACE_LOG, JSON.stringify({ target, input }) + "\\n");
}
if (target.includes("mempalace_checkpoint")) {
  process.stdout.write(JSON.stringify({ added: [{ success: true, drawer_id: "drawer-1", wing: "theseus-local-lab", room: "hooks" }], duplicates: [], errors: [] }));
} else if (target.includes("mempalace_get_drawer")) {
  const content = process.env.FAKE_MEMPALACE_MODE === "mismatch"
    ? "Decision: different content."
    : ${JSON.stringify(event.content)};
  process.stdout.write(JSON.stringify({ drawer_id: input.drawer_id, wing: "theseus-local-lab", room: "hooks", content }));
} else {
  process.exitCode = 2;
}
`, "utf8");
  return script;
}

async function runFlush(env) {
  try {
    const { stdout } = await execFileAsync(process.execPath, ["tools/memory_outbox/flush-mempalace.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    return JSON.parse(stdout.trim() || "{}");
  } catch (error) {
    throw new Error(`flush failed: ${error.stdout || ""}${error.stderr || error.message}`);
  }
}

async function withFixture(mode, callback) {
  const dir = await mkdtemp(join(tmpdir(), "mempalace-receipt-"));
  const queue = join(dir, "events.jsonl");
  const state = join(dir, "processed.json");
  const log = join(dir, "calls.jsonl");
  const fake = await createFakeMcporter(dir);
  await writeFile(queue, `${JSON.stringify(event)}\n`, "utf8");
  await writeFile(state, "[]\n", "utf8");
  try {
    return await callback({
      dir,
      queue,
      state,
      log,
      env: {
        MEMPALACE_MCP_URL: "http://127.0.0.1:18765/mcp",
        MEMORY_OUTBOX_QUEUE_PATH: queue,
        MEMORY_OUTBOX_MEMPALACE_PROCESSED_PATH: state,
        MEMORY_OUTBOX_TEST_MC_PORTER_BIN: process.execPath,
        MEMORY_OUTBOX_TEST_MC_PORTER_PREFIX_ARGS: JSON.stringify([fake]),
        FAKE_MEMPALACE_MODE: mode,
        FAKE_MEMPALACE_LOG: log,
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("keeps MemPalace event pending when drawer read-back mismatches", async () => {
  await withFixture("mismatch", async ({ env, state, log }) => {
    const output = await runFlush(env);
    assert.deepEqual(output, { stored: 0, pending: 1 });
    assert.deepEqual(JSON.parse(await readFile(state, "utf8")), []);
    const calls = (await readFile(log, "utf8")).trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(calls.length, 2);
    assert.match(calls[0].target, /mempalace_checkpoint/);
    assert.match(calls[1].target, /mempalace_get_drawer/);
  });
});

test("processes MemPalace event only after matching drawer read-back", async () => {
  await withFixture("match", async ({ env, state, log }) => {
    const output = await runFlush(env);
    assert.deepEqual(output, { stored: 1, pending: 0 });
    assert.deepEqual(JSON.parse(await readFile(state, "utf8")), [event.event_id]);
    const calls = (await readFile(log, "utf8")).trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input.diary.agent_name, "lad");
    assert.equal(calls[0].input.items[0].wing, "theseus-local-lab");
    assert.equal(calls[0].input.items[0].room, "hooks");
  });
});
