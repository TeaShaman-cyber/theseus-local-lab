import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const script = fileURLToPath(new URL("./run_semantic_wsl.mjs", import.meta.url));

// The bridge spawns wsl.exe, so these tests describe Windows-only behaviour.
// Skipped elsewhere rather than fixed: there is nothing to fix on a host
// without WSL, and a red gate there would be noise, not signal.
const WSL_ONLY = {
  skip: process.platform !== "win32" ? "requires wsl.exe (Windows only)" : false,
};

test("semantic WSL bridge reports missing provider environment without exposing values", WSL_ONLY, async () => {
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

test("semantic WSL bridge accepts an absolute Windows path before spawning", WSL_ONLY, async () => {
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
