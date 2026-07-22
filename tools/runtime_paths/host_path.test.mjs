import assert from "node:assert/strict";
import test from "node:test";

import { preferredDockerHost, resolveHostPath, windowsPathToWsl } from "./host_path.mjs";

test("maps Windows drive paths into WSL", () => {
  assert.equal(windowsPathToWsl("D:/theseus-backup/backups/data"), "/mnt/d/theseus-backup/backups/data");
  assert.equal(windowsPathToWsl("C:\\Users\\s.poklad\\Documents"), "/mnt/c/Users/s.poklad/Documents");
});

test("prefers a mapped WSL path when the Windows spelling is not visible", () => {
  const visible = new Set(["/mnt/d/theseus-backup/backups/data"]);
  assert.equal(
    resolveHostPath("D:/theseus-backup/backups/data", {
      platform: "linux",
      exists: (candidate) => visible.has(candidate),
    }),
    "/mnt/d/theseus-backup/backups/data",
  );
});

test("preserves native paths", () => {
  assert.equal(
    resolveHostPath("/local-backups", { platform: "linux", exists: (candidate) => candidate === "/local-backups" }),
    "/local-backups",
  );
});

test("uses the native Docker socket in WSL-like runtimes", () => {
  assert.equal(
    preferredDockerHost({ platform: "linux", exists: (candidate) => candidate === "/var/run/docker.sock" }),
    "unix:///var/run/docker.sock",
  );
});

test("keeps an explicitly configured Docker route", () => {
  assert.equal(
    preferredDockerHost({ configuredHost: "tcp://docker.example:2375", platform: "linux", exists: () => true }),
    "tcp://docker.example:2375",
  );
});
