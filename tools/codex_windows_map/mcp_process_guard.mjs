const mcpCandidateNames = new Set(["node", "node_repl", "python", "pythonw", "cmd", "wsl"]);
const observerEntrypoints = new Set([
  "codex_windows_map.mjs",
  "sysinternals_scout.mjs",
  "dashboard.mjs",
]);

function normalizeImage(value) {
  return String(value || "").trim().toLowerCase().replace(/\.exe$/, "");
}

function shortHash(value) {
  let hash = 5381;
  for (const char of String(value || "")) hash = (hash * 33) ^ char.charCodeAt(0);
  return (hash >>> 0).toString(16);
}

function commandEntrypoint(commandLine) {
  const matches = String(commandLine || "").match(/[\w./\\:-]+\.(?:mjs|cjs|js|py)\b/gi) || [];
  const candidate = matches.at(-1);
  return candidate ? candidate.split(/[\\/]/).at(-1) : "unknown";
}

export function parsePsListTree(stdout) {
  const rows = [];
  const ancestors = [];
  const linePattern = /^(\s*)(.+?)\s+(\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;

  for (const line of String(stdout || "").split(/\r?\n/)) {
    const match = line.match(linePattern);
    if (!match) continue;
    const indent = match[1].length;
    const row = {
      image: match[2].trim(),
      pid: match[3],
      parent_pid: null,
      indent,
      working_set_kb: Number(match[8]),
      private_kb: Number(match[9]),
    };
    while (ancestors.length && ancestors.at(-1).indent >= indent) ancestors.pop();
    row.parent_pid = ancestors.at(-1)?.pid || null;
    rows.push(row);
    ancestors.push(row);
  }
  return rows;
}

function nearestCodexAncestor(row, byPid) {
  let current = row;
  const visited = new Set();
  while (current?.parent_pid && !visited.has(current.parent_pid)) {
    visited.add(current.parent_pid);
    current = byPid.get(String(current.parent_pid));
    const image = normalizeImage(current?.image);
    if (image === "codex") return current;
    if (image === "chatgpt") return null;
  }
  return null;
}

export function analyzeMcpProcessTree(rows, commandDetails = []) {
  const byPid = new Map(rows.map((row) => [String(row.pid), row]));
  const commandsByPid = new Map(commandDetails.map((row) => [String(row.pid), row]));
  const candidates = rows
    .filter((row) => mcpCandidateNames.has(normalizeImage(row.image)))
    .map((row) => ({ row, codex: nearestCodexAncestor(row, byPid) }))
    .filter((entry) => entry.codex)
    .map(({ row, codex }) => {
      const detail = commandsByPid.get(String(row.pid)) || {};
      const normalizedCommand = String(detail.command_line || "").replace(/\s+/g, " ").trim().toLowerCase();
      return {
        image: row.image,
        pid: String(row.pid),
        parent_pid: row.parent_pid,
        codex_pid: String(codex.pid),
        working_set_kb: row.working_set_kb,
        entrypoint: commandEntrypoint(detail.command_line),
        command_fingerprint: normalizedCommand ? shortHash(normalizedCommand) : null,
      };
    })
    .filter((candidate) => !observerEntrypoints.has(candidate.entrypoint));

  const families = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.codex_pid}:${normalizeImage(candidate.image)}`;
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(candidate);
  }

  const multiplicityGroups = [...families.values()]
    .filter((items) => items.length > 1)
    .map((items) => ({
      codex_pid: items[0].codex_pid,
      image: items[0].image,
      count: items.length,
      pids: items.map((item) => item.pid),
    }));

  const exactGroups = new Map();
  for (const candidate of candidates.filter((item) => item.command_fingerprint)) {
    const key = `${candidate.codex_pid}:${candidate.command_fingerprint}`;
    if (!exactGroups.has(key)) exactGroups.set(key, []);
    exactGroups.get(key).push(candidate);
  }
  const duplicateGroups = [...exactGroups.values()]
    .filter((items) => items.length > 1)
    .map((items) => ({
      codex_pid: items[0].codex_pid,
      image: items[0].image,
      entrypoint: items[0].entrypoint,
      command_fingerprint: items[0].command_fingerprint,
      count: items.length,
      pids: items.map((item) => item.pid),
      working_set_kb: items.reduce((sum, item) => sum + (item.working_set_kb || 0), 0),
    }));

  return {
    status: duplicateGroups.length ? "WARN" : "OK",
    candidate_count: candidates.length,
    multiplicity_groups: multiplicityGroups,
    exact_duplicate_groups: duplicateGroups,
    candidates,
    limitation: "Process ownership is inferred from the PsList tree. Exact duplicates require matching command fingerprints from a bounded PID query.",
  };
}
