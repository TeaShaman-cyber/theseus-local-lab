import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("remote AutoMem without explicit token is skipped safely", () => {
  const output = execFileSync(process.execPath, ["tools/memory_outbox/flush.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, AUTOMEM_API_URL: "https://example.invalid", AUTOMEM_API_TOKEN: "" },
    encoding: "utf8",
  });
  assert.match(output, /\"stored\":0/);
});
