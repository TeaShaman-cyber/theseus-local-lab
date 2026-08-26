import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { shouldQueueResearch } from "./hook-policy.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("research queue is opt-in for every event", () => {
  assert.equal(shouldQueueResearch("UserPromptSubmit", {}), false);
  assert.equal(shouldQueueResearch("PostToolUse", {}), false);
  assert.equal(shouldQueueResearch("UserPromptSubmit", { THESEUS_HOOK_RESEARCH: "0" }), false);
  assert.equal(shouldQueueResearch("UserPromptSubmit", { THESEUS_HOOK_RESEARCH: "" }), false);
  assert.equal(shouldQueueResearch("UserPromptSubmit", { THESEUS_HOOK_RESEARCH: "1" }), true);
  assert.equal(shouldQueueResearch("PostToolUse", { THESEUS_HOOK_RESEARCH: "1" }), true);
});

test("tracked and runtime hook manifests stay in parity", () => {
  const output = execFileSync(process.execPath, ["tools/hook_config/check_hooks.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(output.trim(), "HOOKS_MATCH");
});

function runHook(args, input, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: { ...process.env, ...environment },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.end(input);
  });
}

function startFakeAutoMemServer() {
  const serverSource = String.raw`
import { createServer } from "node:http";
const body = JSON.stringify({ results: [] });
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(body);
});
server.listen(0, "127.0.0.1", () => {
  process.stdout.write(String(server.address().port) + "\n");
});
`;

  const child = spawn(process.execPath, ["--input-type=module", "-e", serverSource], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`fake AutoMem server startup timeout: ${stderr}`));
    }, 5000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const port = stdout.split(/\r?\n/)[0].trim();
      if (settled || !/^\d+$/.test(port)) return;
      settled = true;
      clearTimeout(timer);
      resolve({ child, apiUrl: `http://127.0.0.1:${port}` });
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`fake AutoMem server exited during startup: ${code} ${stderr}`));
    });
  });
}

test("UserPromptSubmit hook forwards the memory reflex system message", async () => {
  const fakeServer = await startFakeAutoMemServer();

  try {
    const result = await runHook(
      ["hooks/hook-router.mjs", "--event", "UserPromptSubmit"],
      JSON.stringify({ prompt: "Preserve Lad continuity while reviewing the hook." }),
      {
        AUTOMEM_API_URL: fakeServer.apiUrl,
        AUTOMEM_HOOK_TIMEOUT_MS: "500",
        AUTOMEM_HOOK_RETRIES: "0",
      },
    );

    assert.equal(result.code, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.match(output.systemMessage, /Memory reflex: AutoMem recall is fresh/i);
    assert.match(output.systemMessage, /Lad identity anchor/i);
    assert.match(output.systemMessage, /Memory preflight refreshed/i);
  } finally {
    fakeServer.child.kill();
  }
});
