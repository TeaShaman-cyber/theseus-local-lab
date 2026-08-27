import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);

async function withFakeAutoMem({ readBack, callback }) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, body: body ? JSON.parse(body) : null });
      if (request.method === "POST" && request.url === "/memory") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ memory_id: "memory-receipt-1" }));
        return;
      }
      if (request.method === "GET" && request.url === "/memory/memory-receipt-1") {
        response.writeHead(readBack ? 200 : 404, { "content-type": "application/json" });
        response.end(readBack ? JSON.stringify({ memory: readBack }) : JSON.stringify({ detail: "not found" }));
        return;
      }
      response.writeHead(404);
      response.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runFlush(apiUrl, queue, state) {
  return execFileAsync(process.execPath, ["tools/memory_outbox/flush.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTOMEM_API_URL: apiUrl,
      AUTOMEM_API_TOKEN: "test-token",
      MEMORY_OUTBOX_QUEUE_PATH: queue,
      MEMORY_OUTBOX_PROCESSED_PATH: state,
    },
    encoding: "utf8",
  });
}

async function makeFixture() {
  const dir = await mkdtemp(join(tmpdir(), "automem-receipt-"));
  const queue = join(dir, "events.jsonl");
  const state = join(dir, "processed.json");
  const event = {
    accept: true,
    semantic: true,
    episodic: false,
    event_id: "event-receipt-1",
    content: "Decision: verify AutoMem storage by read-back.",
  };
  await writeFile(queue, `${JSON.stringify(event)}\n`);
  await writeFile(state, "[]\n");
  return { dir, queue, state, event };
}

test("does not mark AutoMem event processed without matching read-back", async () => {
  const fixture = await makeFixture();
  try {
    await withFakeAutoMem({ readBack: null, callback: async (apiUrl, requests) => {
      const result = await runFlush(apiUrl, fixture.queue, fixture.state);
      const output = JSON.parse(result.stdout);
      assert.equal(output.stored, 0);
      assert.equal(output.pending, 1);
      assert.deepEqual(JSON.parse(await readFile(fixture.state, "utf8")), []);
      assert.deepEqual(requests.map(({ method, url }) => `${method} ${url}`), ["POST /memory", "GET /memory/memory-receipt-1"]);
    } });
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test("marks AutoMem event processed after matching read-back", async () => {
  const fixture = await makeFixture();
  try {
    await withFakeAutoMem({
      readBack: { id: "memory-receipt-1", content: fixture.event.content, metadata: { event_id: fixture.event.event_id } },
      callback: async (apiUrl, requests) => {
        const result = await runFlush(apiUrl, fixture.queue, fixture.state);
        const output = JSON.parse(result.stdout);
        assert.equal(output.stored, 1);
        assert.equal(output.pending, 0);
        assert.deepEqual(JSON.parse(await readFile(fixture.state, "utf8")), [fixture.event.event_id]);
        assert.deepEqual(requests.map(({ method, url }) => `${method} ${url}`), ["POST /memory", "GET /memory/memory-receipt-1"]);
      },
    });
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});
