import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("returns a bounded timeout when the advisor command does not finish", () => {
  const result = spawnSync(
    process.execPath,
    ["tools/copilot_advisor/copilot_advisor.mjs", "safe prompt"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        COPILOT_ADVISOR_COMMAND: process.execPath,
        COPILOT_ADVISOR_ARGS: '-e "setTimeout(() => {}, 10000)"',
        COPILOT_ADVISOR_TIMEOUT_MS: "100",
      },
    },
  );

  assert.equal(result.status, 124);
  assert.match(result.stderr, /timed out after 100ms/);
});
