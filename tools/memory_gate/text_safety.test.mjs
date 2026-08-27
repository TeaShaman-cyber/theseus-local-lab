import assert from "node:assert/strict";
import test from "node:test";

import {
  containsCredentialMaterial,
  extractTranscriptText,
  redactSensitiveText,
} from "./text_safety.mjs";

test("redacts credentials and common private transport values", () => {
  const source = [
    "Decision: keep the route.",
    "AUTOMEM_API_KEY=super-secret-value",
    "Authorization: Bearer very-secret-bearer-value",
    "Contact: alice@example.com",
    "Path: C:\\Users\\s.poklad\\private\\notes.txt",
    "URL: https://example.test/private?token=secret-value",
  ].join(" ");

  const redacted = redactSensitiveText(source);

  assert.match(redacted, /Decision: keep the route\./);
  assert.match(redacted, /\[REDACTED_SECRET\]/g);
  assert.doesNotMatch(redacted, /super-secret-value|very-secret-bearer-value|alice@example\.com/i);
  assert.doesNotMatch(redacted, /C:\\Users\\s\.poklad|https:\/\/example\.test/i);
  assert.equal(containsCredentialMaterial(source), true);
});

test("projects JSONL transcript content without forwarding record envelopes", () => {
  const transcript = [
    JSON.stringify({ payload: { role: "user", content: "Decision: retain the verified route." }, metadata: { private: "omit" } }),
    JSON.stringify({ payload: { role: "assistant", content: [{ type: "text", text: "Path C:\\Users\\s.poklad\\secret.txt" }] } }),
    "not-json",
  ].join("\n");

  const projected = extractTranscriptText(transcript);

  assert.match(projected, /Decision: retain the verified route\./);
  assert.match(projected, /\[REDACTED_PATH\]/);
  assert.doesNotMatch(projected, /payload|metadata|private|not-json|C:\\Users\\s\.poklad/i);
});
