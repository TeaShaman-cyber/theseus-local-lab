import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const compose = fs.readFileSync("tools/sonar_local/compose.yml", "utf8");
const launcher = fs.readFileSync("tools/sonar_local/sonar_docker.mjs", "utf8");

test("HTTP route is localhost-only and launcher exposes http command", () => {
  assert.match(compose, /127\.0\.0\.1:8791:8000/);
  assert.match(compose, /sonar-http/);
  assert.match(launcher, /"http"/);
});

test("launcher command gate admits the http route", () => {
  const commandSet = launcher.match(/const commands = new Set\(\[([^\]]+)\]\)/)?.[1] ?? "";
  assert.match(commandSet, /"http"/);
});
