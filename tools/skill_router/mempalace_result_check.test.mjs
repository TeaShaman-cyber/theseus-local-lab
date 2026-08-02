import test from "node:test";
import assert from "node:assert/strict";
import { verifyMemPalaceResult } from "./mempalace_result_check.mjs";

test("verifies an episodic MemPalace result without promoting it to runtime", () => {
  const result = verifyMemPalaceResult({
    expectedWing: "theseus-local-lab",
    expectedRoom: "skill-router",
    result: {
      wing: "theseus-local-lab",
      room: "skill-router",
      text: "Historical skill-router checkpoint",
      source_path: "/source/checkpoint.md",
    },
  });

  assert.equal(result.status, "verified");
  assert.equal(result.authority, "episodic-verbatim-evidence");
  assert.equal(result.runtime_authority, "not-promoted");
});

test("rejects a result from the wrong MemPalace room", () => {
  const result = verifyMemPalaceResult({
    expectedWing: "theseus-local-lab",
    expectedRoom: "skill-router",
    result: {
      wing: "theseus-local-lab",
      room: "general",
      text: "Unrelated evidence",
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "mempalace-scope-mismatch");
});

test("rejects an incomplete MemPalace result", () => {
  const result = verifyMemPalaceResult({
    expectedWing: "theseus-local-lab",
    expectedRoom: "skill-router",
    result: { wing: "theseus-local-lab", room: "skill-router" },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "mempalace-result-incomplete");
});
