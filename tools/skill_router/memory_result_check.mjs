function normalize(value) {
  return String(value ?? "").trim();
}

export function verifyMemoryRecall({ expectedId, recalled } = {}) {
  const actualId = normalize(recalled?.memory_id);
  const content = normalize(recalled?.content || recalled?.summary);
  const type = normalize(recalled?.type);

  if (!normalize(expectedId)) throw new Error("expectedId is required");
  if (!actualId || !content || !type) {
    return {
      status: "failed",
      reason: "memory-result-incomplete",
      expected_id: expectedId,
      actual_id: actualId || null,
    };
  }

  if (actualId !== expectedId) {
    return {
      status: "failed",
      reason: "memory-id-mismatch",
      expected_id: expectedId,
      actual_id: actualId,
    };
  }

  return {
    status: "verified",
    reason: "memory-result-matches-requested-checkpoint",
    memory_id: actualId,
    memory_type: type,
    content_present: true,
    runtime_authority: "not-promoted",
  };
}
