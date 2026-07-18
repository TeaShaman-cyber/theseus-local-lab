#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CODEX_HOME = "/mnt/c/Users/s.poklad/.codex";
const DEFAULT_THREAD_ID = process.env.CODEX_THREAD_ID || "019f4194-f804-7d70-bf1f-c74e74f7781f";
const DEFAULT_NEW_CWD = "/home/poklad/theseus-local-lab";
const DEFAULT_NEW_WORKSPACE_ROOT = "\\\\wsl.localhost\\Ubuntu-24.04\\home\\poklad\\theseus-local-lab";
const DEFAULT_PROJECT_NAME = "main";

function parseArgs(argv) {
  const args = {
    apply: false,
    codexClosed: false,
    codexHome: DEFAULT_CODEX_HOME,
    threadId: DEFAULT_THREAD_ID,
    newCwd: DEFAULT_NEW_CWD,
    newWorkspaceRoot: DEFAULT_NEW_WORKSPACE_ROOT,
    projectId: null,
    projectName: DEFAULT_PROJECT_NAME,
    updateRolloutMeta: false,
    backupDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1];
    if (item === "--dry-run") args.apply = false;
    else if (item === "--apply") args.apply = true;
    else if (item === "--codex-closed") args.codexClosed = true;
    else if (item === "--codex-home") {
      args.codexHome = next;
      index += 1;
    } else if (item === "--thread") {
      args.threadId = next;
      index += 1;
    } else if (item === "--new-cwd") {
      args.newCwd = next;
      index += 1;
    } else if (item === "--new-workspace-root") {
      args.newWorkspaceRoot = next;
      index += 1;
    } else if (item === "--project-id") {
      args.projectId = next;
      index += 1;
    } else if (item === "--project-name") {
      args.projectName = next;
      index += 1;
    } else if (item === "--backup-dir") {
      args.backupDir = next;
      index += 1;
    } else if (item === "--update-rollout-meta") {
      args.updateRolloutMeta = true;
    } else if (item === "--help" || item === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${item}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node tools/codex_thread_relink/relink_thread_workspace.mjs [--dry-run default]
  node tools/codex_thread_relink/relink_thread_workspace.mjs --apply --codex-closed

Options:
  --codex-home <path>          Codex state directory. Default: ${DEFAULT_CODEX_HOME}
  --thread <id>                Thread id. Default: ${DEFAULT_THREAD_ID}
  --new-cwd <path>             New runtime cwd for the thread. Default: ${DEFAULT_NEW_CWD}
  --new-workspace-root <path>  GUI workspace root. Default: ${DEFAULT_NEW_WORKSPACE_ROOT}
  --project-id <id>            Local project id to update. Auto-detected by name/root if omitted.
  --project-name <name>        Local project name to detect. Default: ${DEFAULT_PROJECT_NAME}
  --backup-dir <path>          Backup directory. Default: <codex-home>/relink-backups/<timestamp>
  --update-rollout-meta        Experimental: rewrite only session_meta/turn_context cwd fields in rollout JSONL.

Safety:
  --apply refuses to run unless --codex-closed is also passed. Close Codex Desktop completely first.
`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function resolveState(args) {
  const codexHome = path.resolve(args.codexHome);
  return {
    codexHome,
    sqlitePath: path.join(codexHome, "state_5.sqlite"),
    globalStatePath: path.join(codexHome, ".codex-global-state.json"),
    configPath: path.join(codexHome, "config.toml"),
    backupDir: args.backupDir
      ? path.resolve(args.backupDir)
      : path.join(codexHome, "relink-backups", timestamp()),
  };
}

function sqliteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqliteQuery(sqlitePath, sql) {
  const result = spawnSync("sqlite3", ["-json", sqlitePath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`sqlite3 failed: ${result.stderr || result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  return trimmed ? JSON.parse(trimmed) : [];
}

function sqliteExec(sqlitePath, sql) {
  const result = spawnSync("sqlite3", [sqlitePath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`sqlite3 failed: ${result.stderr || result.stdout}`);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function backupFiles(state) {
  mkdirSync(state.backupDir, { recursive: true });
  const candidates = [
    state.sqlitePath,
    `${state.sqlitePath}-wal`,
    `${state.sqlitePath}-shm`,
    state.globalStatePath,
    state.configPath,
  ];
  const copied = [];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const target = path.join(state.backupDir, path.basename(file));
    copyFileSync(file, target);
    copied.push(target);
  }
  return copied;
}

function getThread(sqlitePath, threadId) {
  const rows = sqliteQuery(
    sqlitePath,
    `select id, cwd, rollout_path, source, title, git_branch, git_origin_url, cli_version, model, reasoning_effort, thread_source, agent_path from threads where id = ${sqliteLiteral(threadId)} limit 1;`,
  );
  if (!rows[0]) throw new Error(`Thread not found in state_5.sqlite: ${threadId}`);
  return rows[0];
}

function countMatchingCwd(sqlitePath, cwd) {
  const rows = sqliteQuery(sqlitePath, `select count(*) as count from threads where cwd = ${sqliteLiteral(cwd)};`);
  return Number(rows[0]?.count || 0);
}

function detectProject(globalState, args, currentCwd) {
  const projects = globalState["local-projects"] || {};
  if (args.projectId && projects[args.projectId]) return args.projectId;
  if (args.projectId) throw new Error(`Project id not found in global state: ${args.projectId}`);

  const normalizedOldRoot = String(currentCwd || "").replace(/^\\\\\?\\/, "");
  const entries = Object.entries(projects);
  const byName = entries.find(([, project]) => project?.name === args.projectName);
  if (byName) return byName[0];
  const byRoot = entries.find(([, project]) =>
    Array.isArray(project?.rootPaths) &&
    project.rootPaths.some((root) => root === currentCwd || root === normalizedOldRoot),
  );
  return byRoot ? byRoot[0] : null;
}

function makeGlobalPatch(globalState, args, thread, projectId) {
  const next = structuredClone(globalState);
  const projectless = new Set(next["projectless-thread-ids"] || []);
  const wasProjectless = projectless.delete(args.threadId);
  next["projectless-thread-ids"] = [...projectless];

  next["thread-workspace-root-hints"] ||= {};
  const previousHint = next["thread-workspace-root-hints"][args.threadId] || null;
  next["thread-workspace-root-hints"][args.threadId] = args.newWorkspaceRoot;

  next["thread-projectless-output-directories"] ||= {};
  const previousOutputDirectory = next["thread-projectless-output-directories"][args.threadId] || null;
  delete next["thread-projectless-output-directories"][args.threadId];

  next["electron-saved-workspace-roots"] ||= [];
  const oldRoot = String(thread.cwd || "").replace(/^\\\\\?\\/, "");
  const savedBefore = [...next["electron-saved-workspace-roots"]];
  next["electron-saved-workspace-roots"] = [
    args.newWorkspaceRoot,
    ...next["electron-saved-workspace-roots"].filter((root) => root !== args.newWorkspaceRoot && root !== oldRoot),
  ];

  next["active-workspace-roots"] ||= [];
  const activeBefore = [...next["active-workspace-roots"]];
  if (!next["active-workspace-roots"].includes(args.newWorkspaceRoot)) {
    next["active-workspace-roots"].unshift(args.newWorkspaceRoot);
  }

  next["electron-workspace-root-labels"] ||= {};
  const previousLabel = next["electron-workspace-root-labels"][args.newWorkspaceRoot] || null;
  next["electron-workspace-root-labels"][args.newWorkspaceRoot] = args.projectName;
  delete next["electron-workspace-root-labels"][oldRoot];

  let previousProjectRootPaths = null;
  if (projectId) {
    next["local-projects"] ||= {};
    next["local-projects"][projectId] ||= {};
    previousProjectRootPaths = [...(next["local-projects"][projectId].rootPaths || [])];
    next["local-projects"][projectId].rootPaths = [args.newWorkspaceRoot];
    next["local-projects"][projectId].updatedAt = Date.now();
  }

  return {
    next,
    summary: {
      project_id: projectId,
      was_projectless: wasProjectless,
      previous_hint: previousHint,
      previous_output_directory: previousOutputDirectory,
      previous_saved_roots_count: savedBefore.length,
      next_saved_roots_count: next["electron-saved-workspace-roots"].length,
      previous_active_roots_count: activeBefore.length,
      next_active_roots_count: next["active-workspace-roots"].length,
      previous_label: previousLabel,
      previous_project_root_paths: previousProjectRootPaths,
    },
  };
}

function windowsExtendedPathToWsl(filePath) {
  const normalized = String(filePath || "").replace(/^\\\\\?\\/, "");
  const match = /^([A-Za-z]):\\(.*)$/.exec(normalized);
  if (!match) return null;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function rewriteRolloutMetadata(rolloutPath, args) {
  const wslRolloutPath = windowsExtendedPathToWsl(rolloutPath) || rolloutPath;
  if (!existsSync(wslRolloutPath)) return { attempted: true, ok: false, reason: "rollout file not found" };

  const original = readFileSync(wslRolloutPath, "utf8");
  const lines = original.split(/\n/);
  let changed = 0;
  const rewritten = lines.map((line) => {
    if (!line.trim()) return line;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return line;
    }
    const payload = parsed?.payload || parsed;
    if (payload?.cwd) {
      payload.cwd = args.newCwd;
      changed += 1;
    }
    if (payload?.turn_context?.cwd) {
      payload.turn_context.cwd = args.newCwd;
      changed += 1;
    }
    return JSON.stringify(parsed);
  });
  if (changed > 0) writeFileSync(wslRolloutPath, rewritten.join("\n"), "utf8");
  return { attempted: true, ok: true, changed_fields: changed, file: wslRolloutPath };
}

function buildPlan(args, state) {
  if (!existsSync(state.sqlitePath)) throw new Error(`Missing SQLite state: ${state.sqlitePath}`);
  if (!existsSync(state.globalStatePath)) throw new Error(`Missing global state: ${state.globalStatePath}`);

  const thread = getThread(state.sqlitePath, args.threadId);
  const matchingOldCwdCount = countMatchingCwd(state.sqlitePath, thread.cwd);
  const globalState = readJson(state.globalStatePath);
  const projectId = detectProject(globalState, args, thread.cwd);
  const globalPatch = makeGlobalPatch(globalState, args, thread, projectId);

  return {
    thread,
    matchingOldCwdCount,
    globalState,
    globalPatch,
    projectId,
    changes: {
      sqlite: {
        table: "threads",
        id: args.threadId,
        field: "cwd",
        from: thread.cwd,
        to: args.newCwd,
      },
      global_state: globalPatch.summary,
      rollout_metadata: args.updateRolloutMeta
        ? "rewrite structured cwd fields only"
        : "unchanged by default",
    },
  };
}

function applyPlan(args, state, plan) {
  const copied = backupFiles(state);
  sqliteExec(
    state.sqlitePath,
    `update threads set cwd = ${sqliteLiteral(args.newCwd)} where id = ${sqliteLiteral(args.threadId)};`,
  );
  writeJsonAtomic(state.globalStatePath, plan.globalPatch.next);
  const rollout = args.updateRolloutMeta
    ? rewriteRolloutMetadata(plan.thread.rollout_path, args)
    : { attempted: false, reason: "left untouched by default" };
  const verifiedThread = getThread(state.sqlitePath, args.threadId);
  const verifiedGlobal = readJson(state.globalStatePath);
  return {
    backups: copied,
    rollout,
    verify: {
      sqlite_cwd_ok: verifiedThread.cwd === args.newCwd,
      workspace_hint_ok: verifiedGlobal["thread-workspace-root-hints"]?.[args.threadId] === args.newWorkspaceRoot,
      projectless_removed: !(verifiedGlobal["projectless-thread-ids"] || []).includes(args.threadId),
      project_root_ok: plan.projectId
        ? verifiedGlobal["local-projects"]?.[plan.projectId]?.rootPaths?.[0] === args.newWorkspaceRoot
        : null,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && !args.codexClosed) {
    throw new Error("Refusing --apply without --codex-closed. Close Codex Desktop completely, then rerun with --apply --codex-closed.");
  }
  const state = resolveState(args);
  const plan = buildPlan(args, state);
  const result = {
    tool: "codex-thread-relink",
    mode: args.apply ? "apply" : "dry-run",
    codex_home: state.codexHome,
    backup_dir: state.backupDir,
    thread_id: args.threadId,
    project_id: plan.projectId,
    affected_threads: 1,
    current_thread_matching_old_cwd_count: plan.matchingOldCwdCount,
    changes: plan.changes,
    warnings: [
      "Close Codex Desktop before --apply.",
      "This tool does not rewrite raw transcript history unless --update-rollout-meta is explicitly passed.",
      "If Codex overwrites state on shutdown, rerun --dry-run after closing it and before --apply.",
    ],
  };
  if (args.apply) result.apply = applyPlan(args, state, plan);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export {
  buildPlan,
  detectProject,
  makeGlobalPatch,
  resolveState,
  windowsExtendedPathToWsl,
};
