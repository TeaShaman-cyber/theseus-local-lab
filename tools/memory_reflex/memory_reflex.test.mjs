import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function runWithInput(args, input, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      windowsHide: true,
      env: { ...process.env, ...environment },
    });
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

test("UserPromptSubmit memory reflex retries a transient AutoMem timeout", async () => {
  let requestCount = 0;
  const server = createServer((request, response) => {
    requestCount += 1;
    const payload = JSON.stringify({ results: [] });
    const respond = () => {
      if (response.destroyed) return;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(payload);
    };

    if (requestCount === 1) setTimeout(respond, 600);
    else respond();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const apiUrl = `http://127.0.0.1:${address.port}`;

  try {
    const stdout = await runWithInput(
      ["tools/memory_reflex/memory_reflex.mjs", "preflight", "--source", "test"],
      JSON.stringify({ prompt: "Retry a transient AutoMem timeout." }),
      {
        AUTOMEM_API_URL: apiUrl,
        AUTOMEM_HOOK_TIMEOUT_MS: "250",
        AUTOMEM_HOOK_RETRIES: "1",
        AUTOMEM_HOOK_RETRY_DELAY_MS: "10",
      },
    );

    const result = JSON.parse(stdout);
    assert.equal(requestCount, 2);
    assert.match(result.systemMessage, /AutoMem recall is fresh/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
