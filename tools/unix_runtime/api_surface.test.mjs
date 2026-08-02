import test from "node:test";
import assert from "node:assert/strict";
import { validateBaseUrl } from "./api_surface.mjs";

test("accepts HTTPS base URL without credentials", () => {
  assert.equal(validateBaseUrl("https://example.test/").origin, "https://example.test");
});

test("rejects non-HTTPS and credential-bearing URLs", () => {
  assert.throws(() => validateBaseUrl("http://example.test"), /HTTPS/);
  assert.throws(() => validateBaseUrl("https://user:pass@example.test"), /credentials/);
});
