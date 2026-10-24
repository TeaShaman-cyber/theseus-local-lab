const PROVIDER_KEY_RULES = [
  ["provider-key", /\bsk-[A-Za-z0-9_-]{20,}\b/i],
  ["provider-key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/i],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/i],
  ["provider-key", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/i],
  ["provider-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

const SENSITIVE_ASSIGNMENT =
  /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET))\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s#]+)/i;

function isPlaceholder(value) {
  const normalized = String(value)
    .trim()
    .replace(/^['"`]|['"`,;)]$/g, "")
    .trim();

  return (
    normalized === "" ||
    /^\$\{[^}]+\}$/.test(normalized) ||
    /^\$\([^)]+\)$/.test(normalized) ||
    /^\$\{\{\s*[^}]+\s*\}\}$/.test(normalized) ||
    /^\{\{\s*[^}]+\s*\}\}$/.test(normalized) ||
    /^<[^>]+>$/.test(normalized) ||
    /^\*{3,}$/.test(normalized) ||
    /^(?:redacted|placeholder|example|dummy|none|null|unset|not[_ -]?set)$/i.test(normalized) ||
    /^(?:your|replace|change)[_-].*$/i.test(normalized) ||
    /^process\.env\.[A-Z0-9_]+$/i.test(normalized)
  );
}

/** Parse unified diff output, keeping only added lines and their new-file line numbers. */
export function parseAddedLines(diffText) {
  const added = [];
  let currentPath = null;
  let newLineNumber = null;

  for (const line of String(diffText).split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      currentPath = line.slice("+++ b/".length);
      continue;
    }
    if (line.startsWith("+++ ")) {
      currentPath = null;
      continue;
    }
    if (line.startsWith("@@")) {
      const hunk = line.match(/\+(\d+)(?:,\d+)?/);
      newLineNumber = hunk ? Number(hunk[1]) : null;
      continue;
    }
    if (currentPath === null || newLineNumber === null || line.startsWith("\\")) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      added.push({ path: currentPath, line: newLineNumber, content: line.slice(1) });
      newLineNumber += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      // Deleted lines do not advance the new-file line number.
    } else if (line.startsWith(" ")) {
      newLineNumber += 1;
    }
  }

  return added;
}

/** Return metadata-only findings; never include matched secret text. */
export function findRedactionFindings(changedLines) {
  const findings = [];
  const seen = new Set();

  for (const entry of changedLines ?? []) {
    if (!entry || typeof entry.content !== "string") continue;
    const content = entry.content;
    let rule = null;

    const authorization = content.match(
      /\bauthorization["']?\s*:\s*["']?bearer\s+(?:"([^"]*)"|'([^']*)'|([^\s,;]+))/i,
    );
    const authorizationValue = authorization?.[1] ?? authorization?.[2] ?? authorization?.[3];
    if (authorization && !isPlaceholder(authorizationValue)) {
      rule = "raw-authorization-header";
    }

    if (!rule) {
      for (const [ruleName, pattern] of PROVIDER_KEY_RULES) {
        if (pattern.test(content)) {
          rule = ruleName;
          break;
        }
      }
    }

    if (!rule) {
      const assignment = content.match(SENSITIVE_ASSIGNMENT);
      if (assignment && !isPlaceholder(assignment[2])) rule = "sensitive-assignment";
    }

    if (!rule) continue;
    const finding = {
      path: String(entry.path ?? "<unknown>"),
      line: Number.isInteger(entry.line) ? entry.line : 0,
      rule,
    };
    const key = `${finding.path}\u0000${finding.line}\u0000${finding.rule}`;
    if (!seen.has(key)) {
      seen.add(key);
      findings.push(finding);
    }
  }

  return findings;
}

/** Return the pull-request base SHA from a parsed GitHub event payload. */
export function resolvePullRequestBaseSha(eventPayload) {
  const sha = eventPayload?.pull_request?.base?.sha;
  return typeof sha === "string" && /^[a-f0-9]{40}$/i.test(sha) ? sha : null;
}
