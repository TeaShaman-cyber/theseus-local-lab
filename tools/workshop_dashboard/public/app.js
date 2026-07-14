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
  byId("status-view").classList.toggle("hidden", showTasks);
  byId("tasks-view").classList.toggle("hidden", !showTasks);
  byId("refresh").textContent = showTasks ? "Refresh tasks" : "Refresh";
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

byId("refresh").addEventListener("click", refresh);
byId("task-filter").addEventListener("input", renderTaskList);
byId("task-group").addEventListener("change", renderTaskList);
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
