import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { fetchWithTimeout, spawnWithTimeout } from "./provider-timeout.mjs";

test("fetchWithTimeout aborts an unresponsive provider", async () => {
  const server = createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetchWithTimeout(`http://127.0.0.1:${port}`, {}, 50);
    assert.equal(response, null);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("spawnWithTimeout terminates an unresponsive provider process", async () => {
  const result = await spawnWithTimeout(
    process.execPath,
    ["-e", "setTimeout(() => {}, 1000)"],
    { input: "", windowsHide: true },
    50,
  );
  assert.equal(result.timedOut, true);
  assert.equal(result.code, null);
});
