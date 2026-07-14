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
    nodes: ["observatory-db", "git-sync", "log-lattice", "codex-issues", "codex-system", "sysinternals-scout"],
  },
  providers: {
    label: "Providers",
    x: 850,
    y: 300,
    nodes: ["provider-scout"],
  },
};

const edges = [
  ["memory", "infra"],
  ["infra", "persistence"],
  ["memory", "process"],
  ["infra", "workspace"],
  ["persistence", "workspace"],
  ["process", "workspace"],
  ["workspace", "providers"],
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
  if (node.type === "bundle") return "graph-bundle";
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
  const bundles = nodes.filter((node) => node.type === "bundle");
  const tasks = nodes.filter((node) => node.type === "task");
  const positions = new Map();

  groups.forEach((node, index) => positions.set(node.id, polar(590, 310, 255, index, groups.length)));
  caps.forEach((node, index) => positions.set(node.id, polar(590, 310, 105, index, caps.length, Math.PI / 8)));
  bundles.forEach((node, index) => positions.set(node.id, polar(590, 310, 180, index, bundles.length, Math.PI / 10)));
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
      const radius = node.type === "group" ? 34 : node.type === "bundle" ? 28 : node.type === "capability" ? 25 : node.recommended ? 20 : 14;
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
    } else if (location.hash === "#codex-issues") {
      await refreshCodexIssues();
    } else if (location.hash === "#codex-system") {
      await refreshCodexSystem();
    } else if (location.hash === "#provider-scout") {
      await refreshProviderScout();
    } else if (location.hash === "#sysinternals-scout") {
      await refreshSysinternalsScout();
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
  const showCodexIssues = location.hash === "#codex-issues";
  const showCodexSystem = location.hash === "#codex-system";
  const showProviderScout = location.hash === "#provider-scout";
  const showSysinternalsScout = location.hash === "#sysinternals-scout";
  byId("status-view").classList.toggle("hidden", showTasks || showGraph || showCodexIssues || showCodexSystem || showProviderScout || showSysinternalsScout);
  byId("tasks-view").classList.toggle("hidden", !showTasks);
  byId("graph-view").classList.toggle("hidden", !showGraph);
  byId("codex-issues-view").classList.toggle("hidden", !showCodexIssues);
  byId("codex-system-view").classList.toggle("hidden", !showCodexSystem);
  byId("provider-scout-view").classList.toggle("hidden", !showProviderScout);
  byId("sysinternals-scout-view").classList.toggle("hidden", !showSysinternalsScout);
  byId("refresh").textContent = showTasks
    ? "Refresh tasks"
    : showGraph
      ? "Refresh graph"
      : showCodexIssues
        ? "Refresh issues"
        : showCodexSystem
          ? "Refresh system"
          : showProviderScout
            ? "Refresh providers"
            : showSysinternalsScout
              ? "Refresh scout"
              : "Refresh";
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
    ["Bundles", graph.metrics?.bundles],
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

  byId("bundle-list").innerHTML = (graph.nodes || [])
    .filter((node) => node.type === "bundle")
    .map((node) => {
      const linked = (graph.edges || [])
        .filter((edge) => edge.source === node.id && edge.type === "preflights-with")
        .map((edge) => (graph.nodes || []).find((candidate) => candidate.id === edge.target))
        .filter(Boolean);
      return `
        <article class="bundle-card">
          <div class="task-card-head">
            <span class="pill status-OK">BUNDLE</span>
            <strong>${escapeHtml(node.label)}</strong>
          </div>
          <ul>
            ${linked.map((task) => `<li>${escapeHtml(task.label)}</li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");
}

async function refreshGraph() {
  const goal = byId("route-goal").value.trim();
  const response = await fetch(`/api/task-graph?goal=${encodeURIComponent(goal)}`, { cache: "no-store" });
  taskGraph = await response.json();
  renderTaskGraph(taskGraph);
  renderGraphDetails(taskGraph);
}

function renderIssueTags(tags = []) {
  return tags
    .slice(0, 10)
    .map((item) => `<span>${escapeHtml(item.tag)}: ${escapeHtml(item.count)}</span>`)
    .join("");
}

function renderIssueCard(issue) {
  const flags = [
    issue.high_signal ? "high signal" : null,
    issue.is_new ? "new" : null,
    issue.recently_updated ? "updated" : null,
  ].filter(Boolean);
  return `
    <article class="task-card issue-card">
      <div class="task-card-head">
        <span class="pill ${issue.high_signal ? "status-WARN" : "status-OK"}">#${escapeHtml(issue.number)}</span>
        <strong><a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">${escapeHtml(issue.title)}</a></strong>
      </div>
      <div class="task-meta">
        ${flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}
        <span>${escapeHtml(issue.comments)} comments</span>
        ${(issue.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
      <p class="muted">${escapeHtml(issue.excerpt || "")}</p>
    </article>
  `;
}

async function refreshCodexIssues() {
  const response = await fetch("/api/codex-issues", { cache: "no-store" });
  const payload = await response.json();
  byId("updated").textContent = new Date(payload.generated_at || Date.now()).toLocaleString();
  if (!payload.ok) {
    byId("codex-issues-summary").textContent = payload.hint || payload.error || "No issue summary cache.";
    byId("codex-issue-tags").innerHTML = "";
    byId("codex-issue-list").innerHTML = "";
    return;
  }
  byId("codex-issues-total").textContent = String(payload.high_signal_count || 0);
  byId("codex-issues-summary").textContent =
    `${payload.fetched_open_issues} open issues sampled, ${payload.new_count} new, ${payload.updated_count} updated in ${payload.window_hours}h.`;
  byId("codex-issue-tags").innerHTML = renderIssueTags(payload.tags || []);
  byId("codex-issue-list").innerHTML = (payload.issues || [])
    .filter((issue) => issue.high_signal || issue.is_new || issue.recently_updated)
    .slice(0, 18)
    .map(renderIssueCard)
    .join("");
}

function renderVersionRows(payload) {
  const versions = payload.versions || {};
  const rows = [
    ["Codex CLI", versions.codex_cli?.version || "unknown"],
    ["Desktop package", (versions.desktop_app?.versions_from_windowsapps || []).join(", ") || "unknown"],
    ["Discovered paths", String((versions.discovered_paths || []).length)],
  ];
  return rows
    .map(
      ([label, value]) => `
        <div class="check-row">
          <span class="pill status-OK">INFO</span>
          <strong>${escapeHtml(label)}</strong>
          <span class="muted">${escapeHtml(value)}</span>
        </div>
      `,
    )
    .join("");
}

function renderCodexEventTags(events) {
  const tags = events.tags || [];
  const providers = events.providers || [];
  const rows = [
    ...tags.slice(0, 6).map((item) => [`tag:${item.tag}`, item.count]),
    ...providers.slice(0, 4).map((item) => [`provider:${item.provider}`, item.count]),
  ];
  return rows.length
    ? rows
        .map(
          ([label, count]) => `
            <div class="check-row">
              <span class="pill status-WARN">SEEN</span>
              <strong>${escapeHtml(label)}</strong>
              <span class="muted">${escapeHtml(count)}</span>
            </div>
          `,
        )
        .join("")
    : '<div class="check-row"><span class="pill status-OK">OK</span><strong>No matched events</strong><span class="muted">quiet window</span></div>';
}

function renderCodexEvents(events) {
  return (events.events || []).slice(0, 14).map((event) => {
    const title = `${event.time_created || "unknown time"} ${event.provider || "unknown provider"} #${event.event_id || "?"} x${event.occurrences || 1}`;
    return `
      <div class="check-row event-row">
        <span class="pill status-WARN">${escapeHtml(event.level || "?")}</span>
        <strong>${escapeHtml(title)}</strong>
        <span class="muted">${escapeHtml(event.message_excerpt || "")}</span>
      </div>
    `;
  }).join("") || '<div class="check-row"><span class="pill status-OK">OK</span><strong>No matched events</strong><span class="muted">quiet window</span></div>';
}

async function refreshCodexSystem() {
  const response = await fetch("/api/codex-system", { cache: "no-store" });
  const payload = await response.json();
  byId("updated").textContent = new Date(payload.generated_at || Date.now()).toLocaleString();
  if (!payload.ok) {
    byId("codex-system-summary").textContent = payload.hint || payload.error || "No Codex system cache.";
    byId("codex-system-total").textContent = "!";
    byId("codex-version-list").innerHTML = "";
    byId("codex-event-tags").innerHTML = "";
    byId("codex-event-list").innerHTML = "";
    return;
  }
  const matched = payload.windows_events?.matched || 0;
  const uniqueMatched = payload.windows_events?.unique_matched || matched;
  byId("codex-system-total").textContent = String(matched);
  byId("codex-system-total").className = `overall ${matched > 0 ? "status-WARN" : "status-OK"}`;
  byId("codex-system-summary").textContent =
    `${payload.versions?.codex_cli?.version || "unknown CLI"}; ${matched} matched Windows events (${uniqueMatched} unique) in ${payload.windows_events?.window_hours || "?"}h.`;
  byId("codex-version-list").innerHTML = renderVersionRows(payload);
  byId("codex-event-tags").innerHTML = renderCodexEventTags(payload.windows_events || {});
  byId("codex-event-list").innerHTML = renderCodexEvents(payload.windows_events || {});
}

function renderSysinternalsTools(tools) {
  return (tools.items || [])
    .map(
      (tool) => `
        <div class="check-row">
          <span class="pill ${tool.available ? "status-OK" : "status-UNKNOWN"}">${tool.available ? "FOUND" : "MISS"}</span>
          <strong>${escapeHtml(tool.name)}</strong>
          <span class="muted">${escapeHtml(tool.note || "")}</span>
        </div>
      `,
    )
    .join("");
}

function renderSysinternalsProcesses(processes) {
  return (processes.items || []).slice(0, 18).map((process) => {
    const title = `${process.image || "unknown"} #${process.pid || "?"}`;
    const detail = [process.status, process.memory, process.window_title].filter(Boolean).join(" · ");
    return `
      <div class="check-row event-row">
        <span class="pill status-OK">PROC</span>
        <strong>${escapeHtml(title)}</strong>
        <span class="muted">${escapeHtml(detail)}</span>
      </div>
    `;
  }).join("") || '<div class="check-row"><span class="pill status-OK">OK</span><strong>No focused processes</strong><span class="muted">quiet scout window</span></div>';
}

function renderSysinternalsNetwork(network) {
  return (network.by_process || []).slice(0, 20).map((item) => {
    const title = `${item.image || "unknown"} #${item.pid || "?"}`;
    const detail = `${item.total} connections, ${item.listeners} listening, ${item.established} established; ports ${(item.local_ports || []).slice(0, 14).join(", ")}`;
    return `
      <div class="check-row event-row">
        <span class="pill ${item.listeners > 0 ? "status-WARN" : "status-OK"}">NET</span>
        <strong>${escapeHtml(title)}</strong>
        <span class="muted">${escapeHtml(detail)}</span>
      </div>
    `;
  }).join("") || '<div class="check-row"><span class="pill status-OK">OK</span><strong>No network rows</strong><span class="muted">netstat cache empty</span></div>';
}

async function refreshSysinternalsScout() {
  const response = await fetch("/api/sysinternals-scout", { cache: "no-store" });
  const payload = await response.json();
  byId("updated").textContent = new Date(payload.generated_at || Date.now()).toLocaleString();
  if (!payload.ok) {
    byId("sysinternals-scout-summary").textContent = payload.hint || payload.error || "No Sysinternals scout cache.";
    byId("sysinternals-scout-total").textContent = "!";
    byId("sysinternals-scout-total").className = "overall status-WARN";
    byId("sysinternals-tool-list").innerHTML = "";
    byId("sysinternals-process-list").innerHTML = "";
    byId("sysinternals-network-list").innerHTML = "";
    return;
  }
  const interestingProcesses = payload.processes?.interesting_count || 0;
  const interestingConnections = payload.network?.interesting_connections || 0;
  byId("sysinternals-scout-total").textContent = String(interestingProcesses);
  byId("sysinternals-scout-total").className = "overall status-OK";
  byId("sysinternals-scout-summary").textContent =
    `${interestingProcesses} focused processes, ${interestingConnections} focused connections; ${payload.sysinternals_tools?.available_count || 0} Sysinternals CLI tools on PATH.`;
  byId("sysinternals-tool-list").innerHTML = renderSysinternalsTools(payload.sysinternals_tools || {});
  byId("sysinternals-process-list").innerHTML = renderSysinternalsProcesses(payload.processes || {});
  byId("sysinternals-network-list").innerHTML = renderSysinternalsNetwork(payload.network || {});
}

function renderProviderStatus(payload) {
  if (!payload.openai_status?.ok) {
    return `<div class="check-row"><span class="pill status-FAIL">FAIL</span><strong>OpenAI status</strong><span class="muted">${escapeHtml(payload.openai_status?.error || "unavailable")}</span></div>`;
  }
  const rows = [
    ["OpenAI status", payload.openai_status.description || payload.openai_status.indicator || "unknown"],
    ["Active incidents", String(payload.openai_status.active_incidents?.length || 0)],
    ["Maintenances", String(payload.openai_status.scheduled_maintenances?.length || 0)],
  ];
  return rows
    .map(
      ([label, value]) => `
        <div class="check-row">
          <span class="pill ${payload.openai_status.indicator === "none" ? "status-OK" : "status-WARN"}">STATUS</span>
          <strong>${escapeHtml(label)}</strong>
          <span class="muted">${escapeHtml(value)}</span>
        </div>
      `,
    )
    .join("");
}

function renderProviderLocal(payload) {
  const matches = payload.local?.matches || [];
  if (!matches.length) {
    return '<div class="check-row"><span class="pill status-OK">OK</span><strong>No recent local provider symptoms</strong><span class="muted">session scan clean</span></div>';
  }
  return matches
    .map(
      (match) => `
        <div class="check-row">
          <span class="pill status-WARN">${escapeHtml(match.count)}</span>
          <strong>${escapeHtml(match.id)}</strong>
          <span class="muted">${escapeHtml(match.category)} · ${escapeHtml(match.source?.file || "")}</span>
        </div>
      `,
    )
    .join("");
}

function renderProviderGithub(payload) {
  return (payload.github?.searches || [])
    .map(
      (search) => `
        <div class="check-row">
          <span class="pill ${search.ok && search.total_count ? "status-WARN" : search.ok ? "status-OK" : "status-FAIL"}">${escapeHtml(search.ok ? search.total_count : "!")}</span>
          <strong>${escapeHtml(search.query)}</strong>
          <span class="muted">${escapeHtml(search.ok ? (search.items || []).slice(0, 3).map((item) => `#${item.number}`).join(", ") : search.error || search.status)}</span>
        </div>
      `,
    )
    .join("");
}

async function refreshProviderScout() {
  const response = await fetch("/api/provider-scout", { cache: "no-store" });
  const payload = await response.json();
  byId("updated").textContent = new Date(payload.generated_at || Date.now()).toLocaleString();
  if (!payload.ok) {
    byId("provider-scout-summary").textContent = payload.hint || payload.error || "No Provider scout cache.";
    byId("provider-scout-total").textContent = "!";
    byId("provider-scout-total").className = "overall status-WARN";
    byId("provider-status-list").innerHTML = "";
    byId("provider-local-list").innerHTML = "";
    byId("provider-github-list").innerHTML = "";
    return;
  }
  const local = payload.summary?.local_match_count || 0;
  const github = payload.summary?.github_capacity_issue_count || 0;
  byId("provider-scout-total").textContent = String(local);
  byId("provider-scout-total").className = `overall ${payload.summary?.status === "OK" ? "status-OK" : "status-WARN"}`;
  byId("provider-scout-summary").textContent =
    `${payload.summary?.openai_status_indicator || "unknown"} status, ${local} local provider matches, ${github} public GitHub issue matches.`;
  byId("provider-status-list").innerHTML = renderProviderStatus(payload);
  byId("provider-local-list").innerHTML = renderProviderLocal(payload);
  byId("provider-github-list").innerHTML = renderProviderGithub(payload);
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
