const CREDENTIAL_PATTERNS = [
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/i,
  /\b(?:sk|rk|pk|ghp|github_pat|xox[baprs]-)[A-Za-z0-9_-]{12,}\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b[A-Z0-9_]*(?:TOKEN|API[_-]?KEY|SECRET|PASSWORD)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/i,
];

function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      return item && typeof item.text === "string" ? item.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function extractTranscriptContent(rawContent) {
  return String(rawContent || "")
    .split(/\r?\n/)
    .map((line) => {
      try {
        const item = JSON.parse(line);
        const payload = item && typeof item === "object" ? (item.payload || item) : {};
        return contentToText(payload.content);
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

export function containsCredentialMaterial(value) {
  const text = String(value || "");
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text));
}

export function redactSensitiveText(value) {
  return String(value || "")
    .replace(CREDENTIAL_PATTERNS[0], "[REDACTED_PRIVATE_KEY]")
    .replace(CREDENTIAL_PATTERNS[1], "[REDACTED_TOKEN]")
    .replace(CREDENTIAL_PATTERNS[2], "Bearer [REDACTED_TOKEN]")
    .replace(CREDENTIAL_PATTERNS[3], "$1=[REDACTED_SECRET]")
    .replace(/\b(?:https?|file):\/\/[^\s"'<>]+/gi, "[REDACTED_URL]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?:[A-Za-z]:[\\/]|\\\\)[^\s"'<>]+/g, "[REDACTED_PATH]")
    .replace(/\/(?:Users|home|mnt|tmp|var|etc)\/[^\s"'<>]+/g, "[REDACTED_PATH]");
}

export function extractTranscriptText(rawContent) {
  return redactSensitiveText(extractTranscriptContent(rawContent));
}
