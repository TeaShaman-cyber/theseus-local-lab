import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMcpProcessTree, parsePsListTree } from "./mcp_process_guard.mjs";

const tree = `
Name                             Pid Pri Thd  Hnd      VM      WS    Priv
ChatGPT                        29008   8  57 1644 3789910612 188600 286948
  codex                        26232   8  37  494 6464224 259560 339384
    node                       28252   8  13  190 5428628   1260  52948
    node                       45308   8   9  186 5395604   1232  19704
    node_repl                  56764   8  12  113 4288564   1004   1996
com.docker.backend            16288   8  90 1689 6231488 223996 282316
  wsl                          8376   8   1  111 2151745684 856 1144
`;

test("parses PsList indentation into parent PIDs", () => {
  const rows = parsePsListTree(tree);
  assert.equal(rows.find((row) => row.pid === "26232").parent_pid, "29008");
  assert.equal(rows.find((row) => row.pid === "28252").parent_pid, "26232");
  assert.equal(rows.find((row) => row.pid === "8376").parent_pid, "16288");
});

test("warns only when Codex descendants share an exact command fingerprint", () => {
  const rows = parsePsListTree(tree);
  const result = analyzeMcpProcessTree(rows, [
    { pid: "28252", command_line: '"C:\\Program Files\\nodejs\\node.exe" ./mcp/server.mjs' },
    { pid: "45308", command_line: '"C:\\Program Files\\nodejs\\node.exe" ./mcp/server.mjs' },
    { pid: "56764", command_line: "node_repl.exe" },
    { pid: "8376", command_line: "wsl.exe --system" },
  ]);
  assert.equal(result.status, "WARN");
  assert.equal(result.candidate_count, 3);
  assert.equal(result.exact_duplicate_groups.length, 1);
  assert.deepEqual(result.exact_duplicate_groups[0].pids, ["28252", "45308"]);
  assert.equal(result.exact_duplicate_groups[0].entrypoint, "server.mjs");
});

test("keeps different MCP commands as multiplicity evidence without a false exact duplicate", () => {
  const rows = parsePsListTree(tree);
  const result = analyzeMcpProcessTree(rows, [
    { pid: "28252", command_line: "node memory.mjs" },
    { pid: "45308", command_line: "node docker.mjs" },
  ]);
  assert.equal(result.status, "OK");
  assert.equal(result.multiplicity_groups.length, 1);
  assert.equal(result.exact_duplicate_groups.length, 0);
});

test("excludes the snapshot collector from its own MCP duplicate warning", () => {
  const rows = parsePsListTree(`${tree}\n+    wsl                         60612   8   1 111 2151745684 1000 2000\n+    wsl                         62316   8   1 111 2151745684 1000 2000`);
  const result = analyzeMcpProcessTree(rows, [
    { pid: "60612", command_line: "wsl.exe node tools/codex_windows_map/codex_windows_map.mjs snapshot" },
    { pid: "62316", command_line: "wsl.exe node tools/codex_windows_map/codex_windows_map.mjs snapshot" },
  ]);
  assert.equal(result.candidates.some((item) => item.entrypoint === "codex_windows_map.mjs"), false);
  assert.equal(result.exact_duplicate_groups.length, 0);
});
