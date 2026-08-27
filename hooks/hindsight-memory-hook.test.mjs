import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function runHook(input, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["hooks/hindsight-memory-hook.mjs", "Stop"], {
      cwd: repoRoot,
      env: { ...process.env, ...environment },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

async function withCaptureServer(callback) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ url: request.url, body: JSON.parse(body) });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ accepted: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("Hindsight retain sends a bounded text-only sanitized projection", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hindsight-hook-"));
  const transcriptPath = join(dir, "rollout.jsonl");
  await writeFile(
    transcriptPath,
    [
      JSON.stringify({ payload: { role: "user", content: "Decision: keep the route. C:\\Users\\s.poklad\\private\\notes.txt" }, metadata: { private: "omit" } }),
      JSON.stringify({ payload: { role: "assistant", content: "See https://example.test/private and alice@example.com." } }),
    ].join("\n"),
  );

  try {
    await withCaptureServer(async (apiUrl, requests) => {
      const result = await runHook(
        { session_id: "privacy-test-1", transcript_path: transcriptPath },
        { HINDSIGHT_API_URL: apiUrl, HINDSIGHT_HOOK_TIMEOUT_MS: "1000" },
      );
      assert.equal(result.code, 0, result.stderr);
      assert.equal(requests.length, 1, `child stderr: ${result.stderr}; stdout: ${result.stdout}`);
      const content = requests[0].body.items[0].content;
      assert.match(content, /Decision: keep the route\./);
      assert.match(content, /\[REDACTED_PATH\]/);
      assert.match(content, /\[REDACTED_URL\]/);
      assert.match(content, /\[REDACTED_EMAIL\]/);
      assert.doesNotMatch(content, /payload|metadata|C:\\Users\\s\.poklad|https:\/\/example\.test|alice@example\.com/i);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Hindsight retain refuses a transcript containing credential material", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hindsight-hook-"));
  const transcriptPath = join(dir, "rollout.jsonl");
  await writeFile(
    transcriptPath,
    `${JSON.stringify({ payload: { role: "user", content: "Decision: do not retain AUTOMEM_API_KEY=placeholder-value." } })}\n`,
  );

  try {
    await withCaptureServer(async (apiUrl, requests) => {
      const result = await runHook(
        { session_id: "privacy-test-2", transcript_path: transcriptPath },
        { HINDSIGHT_API_URL: apiUrl, HINDSIGHT_HOOK_TIMEOUT_MS: "1000" },
      );
      assert.equal(result.code, 0, result.stderr);
      assert.equal(requests.length, 0);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
