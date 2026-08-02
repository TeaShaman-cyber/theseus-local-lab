import test from "node:test";
import assert from "node:assert/strict";
import { validateEndpointUrl } from "./https_endpoint.mjs";

test("accepts HTTPS endpoint without credentials", () => {
  assert.equal(validateEndpointUrl("https://138-68-66-30.sslip.io/").protocol, "https:");
});

test("rejects HTTP and credential-bearing endpoints", () => {
  assert.throws(() => validateEndpointUrl("http://example.test"), /HTTPS/);
  assert.throws(() => validateEndpointUrl("https://user:pass@example.test"), /credentials/);
});
