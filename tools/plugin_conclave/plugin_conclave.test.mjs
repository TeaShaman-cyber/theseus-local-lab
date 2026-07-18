import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("./catalog.json", import.meta.url), "utf8"));
assert.equal(catalog.schema, "theseus.plugin-conclave.v1");
assert.equal(new Set(catalog.routes.map((route) => route.id)).size, catalog.routes.length);
assert.ok(catalog.capabilities.some((capability) => capability.id === "mempalace-automem"));
assert.ok(catalog.deferred_or_excluded.some((entry) => entry.plugin === "Engram"));

const route = JSON.parse(execFileSync(process.execPath, ["tools/plugin_conclave/plugin_conclave.mjs", "--goal", "peer reviewed paper research"], { encoding: "utf8" }));
assert.equal(route.recommendation.id, "scholarly");
assert.equal(route.recommendation.primary, "consensus");

const claimRoute = JSON.parse(execFileSync(process.execPath, ["tools/plugin_conclave/plugin_conclave.mjs", "--goal", "recent disputed engineering claim"], { encoding: "utf8" }));
assert.equal(claimRoute.recommendation.id, "claim-check");
assert.equal(claimRoute.recommendation.primary, "agora");

console.log("plugin conclave tests passed");
