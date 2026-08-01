import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function runWithInput(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`memory reflex exited ${code}: ${stderr}`));
    });
    child.stdin.end(input);
  });
}

test("UserPromptSubmit memory reflex carries the IDE-first cue", async () => {
  const stdout = await runWithInput(
    ["tools/memory_reflex/memory_reflex.mjs", "preflight", "--source", "test"],
    JSON.stringify({ prompt: "Add a lint task to the workspace." }),
  );

  const result = JSON.parse(stdout);
  assert.match(result.systemMessage, /IDE-first/i);
  assert.match(result.systemMessage, /VS Code/i);
});
