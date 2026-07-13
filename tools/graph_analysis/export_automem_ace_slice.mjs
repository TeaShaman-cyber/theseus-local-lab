import { mkdirSync, writeFileSync } from "node:fs";

const apiUrl = process.env.AUTOMEM_API_URL;
const apiKey = process.env.AUTOMEM_API_KEY;

if (!apiUrl || !apiKey) {
  throw new Error("AUTOMEM_API_URL and AUTOMEM_API_KEY must be provided by Infisical");
}

function shortLabel(node) {
  const entities = node.metadata?.entities ?? {};
  const candidates = [
    ...(entities.projects ?? []),
    ...(entities.tools ?? []),
    ...(entities.organizations ?? []),
    ...(entities.concepts ?? []),
  ].filter(Boolean);
  if (candidates[0]) return String(candidates[0]).slice(0, 42);
  return (node.content ?? node.id ?? "memory").replace(/\s+/g, " ").trim().slice(0, 42);
}

function description(node) {
  return (node.content ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
}

function aceType(node) {
  const type = String(node.type ?? "Context").toLowerCase();
  if (type.includes("decision")) return "solution";
  if (type.includes("pattern")) return "concept";
  if (type.includes("preference") || type.includes("habit") || type.includes("style")) return "skill";
  if (type.includes("insight")) return "concept";
  return "project";
}

const snapshot = await fetch(`${apiUrl}/graph/snapshot`, {
  headers: { "X-API-Key": apiKey },
}).then((response) => {
  if (!response.ok) throw new Error(`AutoMem graph snapshot returned HTTP ${response.status}`);
  return response.json();
});

const nodes = snapshot.nodes ?? [];
const edges = snapshot.edges ?? [];
const byId = new Map(nodes.map((node) => [node.id, node]));
const degree = new Map(nodes.map((node) => [node.id, { in: 0, out: 0, total: 0, types: new Map() }]));

for (const edge of edges) {
  for (const endpoint of [edge.source, edge.target]) {
    const stats = degree.get(endpoint);
    if (!stats) continue;
    stats.total += 1;
    stats.types.set(edge.type, (stats.types.get(edge.type) ?? 0) + 1);
  }
  if (degree.has(edge.source)) degree.get(edge.source).out += 1;
  if (degree.has(edge.target)) degree.get(edge.target).in += 1;
}

const ranked = nodes
  .map((node) => ({ node, degree: degree.get(node.id) }))
  .sort((a, b) => b.degree.total - a.degree.total || (b.node.importance ?? 0) - (a.node.importance ?? 0));

const selectedIds = new Set(ranked.slice(0, 24).map(({ node }) => node.id));
const focusPattern = /automem|mempalace|docker|vscode|keychain|infisical|graph-viewer|operating-mode/i;

for (const { node } of ranked) {
  if (selectedIds.size >= 30) break;
  if ((node.tags ?? []).some((tag) => focusPattern.test(tag))) selectedIds.add(node.id);
}

const selected = [...selectedIds].map((id) => byId.get(id)).filter(Boolean).slice(0, 30);
const idMap = new Map(selected.map((node, index) => [node.id, `m${index + 1}`]));
const relationshipCounts = new Map();

for (const edge of edges) {
  relationshipCounts.set(edge.type, (relationshipCounts.get(edge.type) ?? 0) + 1);
}

const slice = {
  nodeCount: nodes.length,
  edgeCount: edges.length,
  selectedCount: selected.length,
  relationshipTypes: [...relationshipCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  hubs: selected.map((node) => ({
    id: idMap.get(node.id),
    originalId: node.id,
    label: shortLabel(node),
    aceType: aceType(node),
    memoryType: node.type,
    degree: degree.get(node.id).total,
    inDegree: degree.get(node.id).in,
    outDegree: degree.get(node.id).out,
    importance: node.importance,
    tags: (node.tags ?? []).slice(0, 10),
    description: description(node),
  })),
  edges: edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .slice(0, 100)
    .map((edge, index) => ({
      id: `e${index + 1}`,
      source: idMap.get(edge.source),
      target: idMap.get(edge.target),
      label: edge.type,
      strength: edge.strength ?? 0.5,
    })),
};

mkdirSync("outputs/graph_analysis", { recursive: true });
writeFileSync("outputs/graph_analysis/automem_ace_slice_2026-07-13.json", JSON.stringify(slice, null, 2));

console.log(
  JSON.stringify(
    {
      nodeCount: slice.nodeCount,
      edgeCount: slice.edgeCount,
      selectedCount: slice.selectedCount,
      selectedEdges: slice.edges.length,
      topHubs: slice.hubs.slice(0, 8).map((hub) => ({
        label: hub.label,
        degree: hub.degree,
        type: hub.memoryType,
      })),
    },
    null,
    2,
  ),
);
