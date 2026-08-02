export function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
}

export function extractHandle(payload) {
  const values = strings(payload);
  const objectHandle = values.find((value) => /^[0-9a-f]{20,}$/i.test(value));
  if (objectHandle) return objectHandle;
  const text = values.join(" ");
  return text.match(/[0-9a-f]{20,}/i)?.[0] || null;
}

export function resultText(payload) {
  return strings(payload?.result?.content).join(" ");
}

export function peopleCount(payload) {
  const text = resultText(payload);
  if (/No people found/i.test(text)) return 0;
  const match = text.match(/People\D{0,10}(\d+)|(\d+)\s+people/i);
  return match ? Number(match[1] || match[2]) : null;
}

export function isSuccessfulReport(report) {
  return report.initial_people_count === 0
    && report.precondition === "passed" && report.create === "passed" && report.read === "passed"
    && report.update === "passed" && report.delete === "passed"
    && report.cleanup_status === "not_needed"
    && report.final_people_count === 0 && report.synthetic_record_remains === false;
}
