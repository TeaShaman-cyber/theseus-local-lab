import test from "node:test";
import assert from "node:assert/strict";
import { parseListeners } from "./caddy_status.mjs";

test("parses only HTTP and HTTPS listeners", () => {
  const listeners = parseListeners("LISTEN 0 4096 0.0.0.0:80 0.0.0.0:* users:(('caddy',pid=1))\nLISTEN 0 4096 127.0.0.1:5000 0.0.0.0:* users:(('docker-proxy',pid=2))\nLISTEN 0 4096 [::]:443 [::]:* users:(('caddy',pid=3))\n");
  assert.deepEqual(listeners.map(({ address, port }) => ({ address, port })), [
    { address: "0.0.0.0", port: 80 },
    { address: "[::]", port: 443 },
  ]);
});

test("does not treat an absent listener as healthy", () => {
  const listeners = parseListeners("LISTEN 0 4096 127.0.0.1:5000 0.0.0.0:*\n");
  assert.equal(listeners.length, 0);
});
