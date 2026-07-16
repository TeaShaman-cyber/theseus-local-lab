import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const profiles = JSON.parse(await readFile(new URL("./corpus_profiles.json", import.meta.url), "utf8"));

test("each Graphify corpus profile defines smoke nodes from its own corpus", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    assert.ok(profile.smoke, `${name} needs a smoke definition`);
    assert.ok(profile.smoke.query, `${name} needs a query`);
    assert.ok(profile.smoke.explain, `${name} needs an explain node`);
    assert.ok(profile.smoke.path?.from, `${name} needs a path start`);
    assert.ok(profile.smoke.path?.to, `${name} needs a path end`);
  }
});
