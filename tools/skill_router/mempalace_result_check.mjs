function normalize(value) {
  return String(value ?? "").trim();
}

export function verifyMemPalaceResult({ result, expectedWing, expectedRoom } = {}) {
  const text = normalize(result?.text);
  const wing = normalize(result?.wing);
  const room = normalize(result?.room);

  if (!text || !wing || !room) {
    return { status: "failed", reason: "mempalace-result-incomplete" };
  }

  if (wing !== expectedWing || room !== expectedRoom) {
    return {
      status: "failed",
      reason: "mempalace-scope-mismatch",
      expected: { wing: expectedWing, room: expectedRoom },
      actual: { wing, room },
    };
  }

  return {
    status: "verified",
    reason: "mempalace-episodic-result-matches-scope",
    source_path: normalize(result?.source_path) || null,
    content_present: true,
    authority: "episodic-verbatim-evidence",
    runtime_authority: "not-promoted",
  };
}
