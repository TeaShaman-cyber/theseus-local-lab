import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPopulation,
  formatPopulationReceipt,
  parseTestCounts,
} from "./check_lib.mjs";

const LIVENESS = { at: "2026-10-28T18:00:00.000Z", node: "v24.18.0", platform: "linux", pid: 42 };

const GREEN_WITH_SKIP = [
  { id: "unit", status: "ok" },
  { id: "contract", status: "ok" },
  { id: "redaction", status: "ok" },
  { id: "diff-check", status: "ok" },
  { id: "secret-scan", status: "skip", reason: "no staged files" },
];

/**
 * The destructive test from issue #106: delete the projection, rebuild it from the
 * source record, demand the same bytes. A receipt that cannot survive this is a
 * rumour with good formatting.
 */
test("receipt is reproducible from the population record", () => {
  const population = buildPopulation(GREEN_WITH_SKIP, {
    tests: { tests: 227, pass: 225, fail: 0, skipped: 2 },
    liveness: LIVENESS,
  });

  const first = formatPopulationReceipt(population);
  const rebuilt = formatPopulationReceipt(JSON.parse(JSON.stringify(population)));

  assert.equal(rebuilt, first);
});

test("a green run names what it excluded instead of hiding it behind the verdict", () => {
  const population = buildPopulation(GREEN_WITH_SKIP, {
    tests: { tests: 227, pass: 225, fail: 0, skipped: 2 },
    liveness: LIVENESS,
  });
  const receipt = formatPopulationReceipt(population);

  assert.equal(population.result, "pass");
  assert.match(receipt, /population_steps=5 ok=4 failed=0 skipped=1/);
  assert.match(receipt, /population_tests=227 pass=225 fail=0 skipped=2/);
  assert.match(receipt, /population_skipped id=secret-scan reason=no staged files/);
  assert.match(receipt, /population_liveness at=2026-10-28T18:00:00\.000Z node=v24\.18\.0/);
});

test("unparsed test counts stay UNKNOWN rather than becoming zero", () => {
  const population = buildPopulation(GREEN_WITH_SKIP, { tests: null, liveness: LIVENESS });
  const receipt = formatPopulationReceipt(population);

  assert.match(receipt, /population_tests=unknown reason=runner-printed-no-summary/);
  assert.doesNotMatch(receipt, /population_tests=0/);
});

test("a failing step makes the record fail even when other steps passed", () => {
  const population = buildPopulation(
    [...GREEN_WITH_SKIP.slice(0, 3), { id: "diff-check", status: "fail", exitCode: 2 }],
    { tests: { tests: 10, pass: 9, fail: 1, skipped: 0 }, liveness: LIVENESS },
  );

  assert.equal(population.result, "fail");
  assert.equal(population.examined.failed, 1);
});

test("a run with no successful step never reports pass", () => {
  const population = buildPopulation([{ id: "unit", status: "skip", reason: "nothing to do" }], {
    liveness: LIVENESS,
  });

  assert.equal(population.result, "fail");
});

test("node:test summary is parsed, and absence is not mistaken for zero", () => {
  const hashStyle = ["not ok 1 - something", "# tests 227", "# pass 225", "# fail 0", "# skipped 2"].join("\n");
  const infoStyle = ["ℹ tests 6", "ℹ pass 6", "ℹ fail 0", "ℹ skipped 0"].join("\n");

  assert.deepEqual(parseTestCounts(hashStyle), { tests: 227, pass: 225, fail: 0, skipped: 2 });
  assert.deepEqual(parseTestCounts(infoStyle), { tests: 6, pass: 6, fail: 0, skipped: 0 });
  assert.equal(parseTestCounts("no summary here"), null);
  assert.equal(parseTestCounts(""), null);
});
