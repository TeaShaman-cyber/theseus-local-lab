import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const script = fileURLToPath(new URL("./run_semantic_wsl.mjs", import.meta.url));

test("semantic WSL bridge reports missing provider environment without exposing values", async () => {
  await assert.rejects(
    run(process.execPath, [script, "--check-env"], { env: { PATH: process.env.PATH } }),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /missing-provider-environment/);
      assert.doesNotMatch(error.stderr, /API_KEY=/);
      return true;
    },
  );
});

test("semantic WSL bridge startup does not expose provider credentials", { skip: process.platform !== "win32" }, async () => {
  const result = await run(process.execPath, [script, "--check-env"], {
    env: {
      PATH: process.env.PATH,
      BOTHUB_API_KEY: "test-key",
      BOTHUB_BASE_URL: "https://example.invalid/v1",
      BOTHUB_MODEL: "test-model",
    },
  });
  assert.match(result.stderr, /graphify_semantic_start/);
  assert.doesNotMatch(result.stderr, /test-key/);
});
