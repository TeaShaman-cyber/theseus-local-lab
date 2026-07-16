import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const repoRoot = new URL("../..", import.meta.url).pathname;

test("compact state packets preserve the IDE-first route", async () => {
  const { stdout } = await run(
    process.execPath,
    [
      "tools/memory_hook/memory_hook.mjs",
      "--mode",
      "compact",
      "--summary",
      "IDE continuity test",
      "--goal",
      "Preserve routing after context compaction",
    ],
    { cwd: repoRoot, windowsHide: true },
  );
  const result = JSON.parse(stdout);
  const packet = await readFile(result.packet_path, "utf8");

  assert.match(packet, /## IDE Continuity/);
  assert.match(packet, /VS Code tasks/i);
});
