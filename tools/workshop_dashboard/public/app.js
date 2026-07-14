const groups = {
  memory: {
    label: "Memory",
    x: 150,
    y: 90,
    nodes: ["automem-api", "graph-viewer", "state-packet"],
  },
  infra: {
    label: "Infrastructure",
    x: 460,
    y: 90,
    nodes: ["docker-tcp", "docker-control", "automem-containers", "keychain"],
  },
  persistence: {
    label: "Persistence",
    x: 770,
    y: 90,
    nodes: ["latest-backup", "cloud-mirror", "backup-runner"],
  },
  process: {
    label: "Process",
    x: 300,
    y: 300,
    nodes: ["research-queue", "session-timeline"],
  },
  workspace: {
    label: "Workspace",
    x: 620,
    y: 300,
    nodes: ["observatory-db", "git-sync", "log-lattice"],
  },
};

const edges = [
  ["memory", "infra"],
  ["infra", "persistence"],
  ["memory", "process"],
  ["infra", "workspace"],
  ["persistence", "workspace"],
  ["process", "workspace"],
];

function statusClass(status) {
  return `status-${status || "UNKNOWN"}`;
}

function statusColor(status) {
  if (status === "OK") return "var(--ok)";
  if (status === "WARN") return "var(--warn)";
  if (status === "FAIL") return "var(--fail)";
  return "var(--unknown)";
}

function groupStatus(rows, ids) {
  const rank = { OK: 0, WARN: 1, FAIL: 2 };
  return ids.reduce((worst, id) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return worst;
    return rank[row.status] > rank[worst] ? row.status : worst;
  }, "OK");
}

function byId(id) {
  return document.getElementById(id);
}

let taskCatalog = null;
let taskGraph = null;

function renderMap(dashboard) {
  const svg = byId("map");
  const rows = dashboard.rows || [];
  const groupEntries = Object.entries(groups).map(([id, group]) => ({
    id,
    ...group,
    status: groupStatus(rows, group.nodes),
  }));

  const edgeMarkup = edges
    .map(([from, to]) => {
      const a = groups[from];
      const b = groups[to];
      return `<line class="edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`;
    })
    .join("");

  const groupMarkup = groupEntries
    .map((group) => {
      const visible = group.nodes
        .map((id) => rows.find((row) => row.id === id))
        .filter(Boolean);
      const detail = visible.map((row) => row.status).join(" / ");
      return `
        <g>
          <text class="group-label" x="${group.x - 62}" y="${group.y - 58}">${group.label}</text>
          <circle class="node ${statusClass(group.status)}" cx="${group.x}" cy="${group.y}" r="48" stroke="${statusColor(group.status)}"></circle>
          <text class="node-label" x="${group.x}" y="${group.y - 3}" text-anchor="middle">${group.status}</text>
          <text class="node-detail" x="${group.x}" y="${group.y + 17}" text-anchor="middle">${detail}</text>
        </g>
      `;
    })
    .join("");

  svg.innerHTML = `
    <title id="map-title">Theseus workshop system map</title>
    <desc id="map-desc">A grouped status graph for memory, infrastructure, persistence, process, and workspace checks.</desc>
    ${edgeMarkup}
    ${groupMarkup}
  `;
}

function polar(cx, cy, radius, index, total, phase = -Math.PI / 2) {
  const angle = phase + (Math.PI * 2 * index) / Math.max(1, total);
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function graphNodeClass(node) {
  if (node.type === "group") return "graph-group";
  if (node.type === "capability") return "graph-capability";
  if (node.recommended) return "graph-recommended";
  if (node.kind === "check") return "graph-check";
  if (node.kind === "action") return "graph-action";
  return "graph-task";
}

function renderTaskGraph(graph) {
  const svg = byId("task-graph");
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const groups = nodes.filter((node) => node.type === "group");
  const caps = nodes.filter((node) => node.type === "capability");
  const tasks = nodes.filter((node) => node.type === "task");
  const positions = new Map();

  groups.forEach((node, index) => positions.set(node.id, polar(590, 310, 255, index, groups.length)));
  caps.forEach((node, index) => positions.set(node.id, polar(590, 310, 105, index, caps.length, Math.PI / 8)));
  tasks.forEach((node, index) => {
    const groupIndex = Math.max(0, groups.findIndex((group) => group.id === `group:${node.group}`));
    const base = polar(590, 310, 255, groupIndex, groups.length);
    const jitter = polar(base.x, base.y, 54 + (index % 3) * 26, index, tasks.length, Math.PI / 5);
    positions.set(node.id, jitter);
  });

  const visibleTaskIds = new Set([
    ...tasks.filter((node) => node.recommended).map((node) => node.id),
    ...tasks.filter((node) => node.kind === "check").slice(0, 20).map((node) => node.id),
  ]);
  const visibleNodes = nodes.filter((node) => node.type !== "task" || visibleTaskIds.has(node.id));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));

  const edgeMarkup = visibleEdges
    .map((edge) => {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) return "";
      return `<line class="edge graph-edge" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"></line>`;
    })
    .join("");

  const nodeMarkup = visibleNodes
    .map((node) => {
      const p = positions.get(node.id);
      const radius = node.type === "group" ? 34 : node.type === "capability" ? 25 : node.recommended ? 20 : 14;
      const label = node.type === "task" ? node.label.replace(/^Theseus:?\s*/i, "").slice(0, 22) : node.label;
      return `
        <g>
          <circle class="graph-node ${graphNodeClass(node)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius}"></circle>
          <text class="graph-label" x="${p.x.toFixed(1)}" y="${(p.y + radius + 13).toFixed(1)}" text-anchor="middle">${escapeHtml(label)}</text>
        </g>
      `;
    })
    .join("");

  svg.innerHTML = `
    <title id="task-graph-title">VS Code task relation graph</title>
    <desc id="task-graph-desc">Groups, tasks, capabilities, and recommended route candidates.</desc>
    ${edgeMarkup}
    ${nodeMarkup}
  `;
}

function renderRows(dashboard) {
  const checks = byId("checks");
  const warnings = byId("warnings");
  const rows = dashboard.rows || [];
  const warningRows = rows.filter((row) => row.status !== "OK");

  checks.innerHTML = rows
    .map(
      (row) => `
        <div class="check-row">
          <span class="pill ${statusClass(row.status)}">${row.status}</span>
          <strong>${row.label}</strong>
          <span class="muted">${row.detail || ""}</span>
        </div>
      `,
    )
    .join("");

  warnings.innerHTML = warningRows.length
    ? warningRows.map((row) => `<li><strong>${row.label}</strong>: ${row.detail || row.status}</li>`).join("")
    : "<li>No warnings right now.</li>";
}

function render(dashboard) {
  const overall = byId("overall");
  overall.className = `overall ${statusClass(dashboard.overall)}`;
  overall.textContent = dashboard.overall || "...";

  byId("summary-title").textContent =
    dashboard.overall === "OK"
      ? "Workshop is steady"
      : dashboard.overall === "FAIL"
        ? "One core route needs attention"
        : "Workshop is usable with warnings";
  const warnings = (dashboard.rows || []).filter((row) => row.status !== "OK");
  byId("summary-detail").textContent = warnings.length
    ? `${warnings.length} area(s) need attention. Core memory and backup routes stay visible below.`
    : "All visible workshop routes report OK.";
  byId("updated").textContent = new Date(dashboard.generated_at).toLocaleString();

  renderMap(dashboard);
  renderRows(dashboard);
}

async function refresh() {
  byId("refresh").disabled = true;
  try {
    if (location.hash === "#tasks") {
      await refreshTasks();
    } else if (location.hash === "#graph") {
      await refreshGraph();
    } else {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const dashboard = await response.json();
      render(dashboard);
    }
  } catch (error) {
    render({
      generated_at: new Date().toISOString(),
      overall: "FAIL",
      rows: [{ id: "dashboard-api", label: "Dashboard API", status: "FAIL", detail: error.message }],
    });
  } finally {
    byId("refresh").disabled = false;
  }
}

function switchView() {
  const showTasks = location.hash === "#tasks";
  const showGraph = location.hash === "#graph";
  byId("status-view").classList.toggle("hidden", showTasks || showGraph);
  byId("tasks-view").classList.toggle("hidden", !showTasks);
  byId("graph-view").classList.toggle("hidden", !showGraph);
  byId("refresh").textContent = showTasks ? "Refresh tasks" : showGraph ? "Refresh graph" : "Refresh";
  refresh();
}

function taskKindClass(kind) {
  if (kind === "check") return "status-OK";
  if (kind === "action") return "status-WARN";
  if (kind === "advisor") return "status-UNKNOWN";
  return "status-UNKNOWN";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function renderTaskGroups(catalog) {
  byId("task-total").textContent = String(catalog.total || 0);
  const groupSelect = byId("task-group");
  const selected = groupSelect.value || "all";
  groupSelect.innerHTML = '<option value="all">All groups</option>';
  for (const group of catalog.groups || []) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = `${group.label} (${group.count})`;
    groupSelect.append(option);
  }
  groupSelect.value = [...groupSelect.options].some((option) => option.value === selected) ? selected : "all";

  byId("task-groups").innerHTML = (catalog.groups || [])
    .map(
      (group) => `
        <button class="task-group" type="button" data-group="${escapeHtml(group.id)}">
          <strong>${escapeHtml(group.label)}</strong>
          <span>${group.count} tasks</span>
          <small>${group.checks} checks · ${group.actions} actions · ${group.advisors} advisors</small>
        </button>
      `,
    )
    .join("");
}

function renderTaskList() {
  if (!taskCatalog) return;
  const query = byId("task-filter").value.trim().toLowerCase();
  const group = byId("task-group").value;
  const tasks = (taskCatalog.tasks || []).filter((task) => {
    const text = `${task.label} ${task.command} ${task.group_label} ${task.route_hint}`.toLowerCase();
    return (group === "all" || task.group === group) && (!query || text.includes(query));
  });

  byId("task-list").innerHTML = tasks
    .map(
      (task) => `
        <article class="task-card">
          <div class="task-card-head">
            <span class="pill ${taskKindClass(task.kind)}">${escapeHtml(task.kind)}</span>
            <strong>${escapeHtml(task.label)}</strong>
          </div>
          <div class="task-meta">
            <span>${escapeHtml(task.group_label)}</span>
            <span>${escapeHtml(task.route_hint)}</span>
            ${task.has_inputs ? "<span>needs input</span>" : "<span>no input</span>"}
          </div>
          <code>${escapeHtml(task.command || "(no command)")}</code>
          <div class="task-actions">
            <button type="button" data-copy-label="${escapeHtml(task.label)}">Copy label</button>
            <button type="button" data-copy-command="${escapeHtml(task.command)}">Copy command</button>
          </div>
        </article>
      `,
    )
    .join("");
}

async function refreshTasks() {
  const response = await fetch("/api/tasks", { cache: "no-store" });
  taskCatalog = await response.json();
  byId("updated").textContent = new Date(taskCatalog.generated_at).toLocaleString();
  renderTaskGroups(taskCatalog);
  renderTaskList();
}

function renderGraphDetails(graph) {
  byId("graph-total").textContent = String(graph.metrics?.tasks || 0);
  byId("updated").textContent = new Date(graph.generated_at).toLocaleString();
  byId("graph-metrics").innerHTML = [
    ["Nodes", graph.metrics?.nodes],
    ["Edges", graph.metrics?.edges],
    ["Groups", graph.metrics?.groups],
    ["Capabilities", graph.metrics?.capabilities],
    ["Tasks", graph.metrics?.tasks],
  ]
    .map(
      ([label, value]) => `
        <div class="check-row">
          <span class="pill status-OK">GRAPH</span>
          <strong>${escapeHtml(label)}</strong>
          <span class="muted">${escapeHtml(value)}</span>
        </div>
      `,
    )
    .join("");

  byId("route-list").innerHTML = (graph.recommendations || [])
    .map(
      (task) => `
        <div class="check-row route-row">
          <span class="pill ${taskKindClass(task.kind)}">${escapeHtml(task.score)}</span>
          <strong>${escapeHtml(task.label)}</strong>
          <span class="muted">${escapeHtml(task.why?.join(" · ") || task.route_hint)}</span>
        </div>
      `,
    )
    .join("");
}

async function refreshGraph() {
  const goal = byId("route-goal").value.trim();
  const response = await fetch(`/api/task-graph?goal=${encodeURIComponent(goal)}`, { cache: "no-store" });
  taskGraph = await response.json();
  renderTaskGraph(taskGraph);
  renderGraphDetails(taskGraph);
}

byId("refresh").addEventListener("click", refresh);
byId("task-filter").addEventListener("input", renderTaskList);
byId("task-group").addEventListener("change", renderTaskList);
byId("route-refresh").addEventListener("click", refreshGraph);
byId("route-goal").addEventListener("keydown", (event) => {
  if (event.key === "Enter") refreshGraph();
});
byId("task-groups").addEventListener("click", (event) => {
  const button = event.target.closest("[data-group]");
  if (!button) return;
  byId("task-group").value = button.dataset.group;
  renderTaskList();
});
byId("task-list").addEventListener("click", (event) => {
  const labelButton = event.target.closest("[data-copy-label]");
  if (labelButton) copyText(labelButton.dataset.copyLabel);
  const commandButton = event.target.closest("[data-copy-command]");
  if (commandButton) copyText(commandButton.dataset.copyCommand);
});
window.addEventListener("hashchange", switchView);
if (!location.hash) location.hash = "#status";
switchView();
setInterval(refresh, 60_000);
