#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env, exit } from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const observatoryProbe = "D:/theseus-observatory/tools/docker_proxy_probe/docker_proxy_probe.mjs";
const observatoryProbeWsl = "/mnt/d/theseus-observatory/tools/docker_proxy_probe/docker_proxy_probe.mjs";
const projectPaths = [
  "D:/theseus-backup",
  "D:/theseus-knowledge-base",
  "D:/theseus-nii",
  "D:/theseus-observatory",
  "D:/theseus-public-observatory",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: { ...env, ...(options.env || {}) },
    encoding: "utf8",
    timeout: options.timeoutMs || 15_000,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error?.message,
  };
}

function wsl(script, options = {}) {
  return run("wsl.exe", ["-e", "sh", "-lc", script], options);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeDockerProbe(output) {
  const parsed = parseJson(output);
  if (!parsed) return { verdict: "UNKNOWN", parse_error: true, raw: output.slice(0, 500) };
  return {
    verdict: parsed.verdict || "UNKNOWN",
    ping: parsed.checks?.ping?.status || "UNKNOWN",
    version: parsed.checks?.version?.status || "UNKNOWN",
    containers: parsed.checks?.containers?.status || "UNKNOWN",
    blocked_post: parsed.checks?.blockedPost?.status || "UNKNOWN",
  };
}

function check(name, status, detail, evidence = {}) {
  return { name, status, detail, evidence };
}

function readMaybeJson(filePath) {
  if (!existsSync(filePath)) return { exists: false };
  try {
    return { exists: true, parse_ok: true, value: JSON.parse(readFileSync(filePath, "utf8")) };
  } catch (error) {
    return { exists: true, parse_ok: false, error: error.message };
  }
}

function scanText(filePath, patterns) {
  if (!existsSync(filePath)) return { exists: false, hits: [] };
  const text = readFileSync(filePath, "utf8");
  return {
    exists: true,
    hits: patterns
      .map((pattern) => ({ pattern: pattern.label, count: (text.match(pattern.regex) || []).length }))
      .filter((hit) => hit.count > 0),
  };
}

function statusRank(status) {
  return { OK: 0, WARN: 1, FAIL: 2 }[status] ?? 1;
}

function parseArgs(argv) {
  return {
    write: !argv.includes("--no-write"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [];

  const winNode = run("node", ["--version"], { timeoutMs: 5_000 });
  checks.push(
    check(
      "windows-node",
      winNode.ok ? "OK" : "FAIL",
      winNode.ok ? `Windows Node ${winNode.stdout}` : "Windows Node is not available",
      winNode,
    ),
  );

  const windowsDocker = run("docker", ["version", "--format", "{{.Server.Version}}"], { timeoutMs: 15_000 });
  checks.push(
    check(
      "windows-native-docker",
      windowsDocker.ok ? "OK" : "WARN",
      windowsDocker.ok
        ? `Windows reaches Docker Desktop directly (server ${windowsDocker.stdout})`
        : "Windows Docker CLI did not verify; inspect Docker Desktop before a migration pilot",
      windowsDocker,
    ),
  );

  const winProbe = existsSync(observatoryProbe)
    ? run("node", [observatoryProbe], { timeoutMs: 15_000 })
    : { ok: false, stdout: "", stderr: "probe file missing" };
  const winProbeSummary = summarizeDockerProbe(winProbe.stdout);
  checks.push(
    check(
      "windows-legacy-docker-proxy",
      windowsDocker.ok || (winProbe.ok && winProbeSummary.verdict === "OK") ? "OK" : "WARN",
      winProbe.ok && winProbeSummary.verdict === "OK"
        ? "Optional legacy Docker proxy works from Windows"
        : windowsDocker.ok
          ? "N/A: Windows reaches Docker Desktop directly"
          : "Legacy Docker proxy did not verify; direct Docker CLI is the preferred route",
      { ...winProbeSummary, native_docker_ready: windowsDocker.ok, stderr: winProbe.stderr || undefined },
    ),
  );

  const wslIdentity = wsl(
    [
      "printf 'user=%s\\nhome=%s\\n' \"$USER\" \"$HOME\"",
      "command -v node | sed 's#^#node=#'",
      "node --version | sed 's#^#node_version=#'",
      "command -v git | sed 's#^#git=#'",
      "command -v gh | sed 's#^#gh=#' || true",
    ].join("; "),
    { timeoutMs: 10_000 },
  );
  checks.push(
    check(
      "wsl-runtime",
      wslIdentity.ok && /node=/.test(wslIdentity.stdout) && /git=/.test(wslIdentity.stdout) ? "OK" : "WARN",
      "WSL runtime has user, Node, and Git visibility",
      wslIdentity,
    ),
  );

  const wslRuntimeEnv = wsl(
    [
      "printf 'CODEX_HOME=%s\\nWSLENV=%s\\nTMP=%s\\nTEMP=%s\\nXDG_RUNTIME_DIR=%s\\n' \"$CODEX_HOME\" \"$WSLENV\" \"$TMP\" \"$TEMP\" \"$XDG_RUNTIME_DIR\"",
    ].join("; "),
    { timeoutMs: 5_000 },
  );
  const runtimeEnvText = wslRuntimeEnv.stdout || "";
  const envWarnings = [];
  if (/CODEX_HOME=\/mnt\/[a-z]\//i.test(runtimeEnvText)) envWarnings.push("CODEX_HOME is on DrvFS");
  if (/WSLENV=.*(?:TEMP|TMP)/i.test(runtimeEnvText)) envWarnings.push("WSLENV forwards TEMP/TMP");
  if (/(?:TMP|TEMP)=\/mnt\/[a-z]\//i.test(runtimeEnvText)) envWarnings.push("TEMP/TMP points to DrvFS");
  checks.push(
    check(
      "wsl-runtime-env",
      wslRuntimeEnv.ok && envWarnings.length === 0 ? "OK" : "WARN",
      envWarnings.length === 0 ? "WSL runtime env has no obvious Codex/Temp portability leak" : envWarnings.join("; "),
      { stdout: runtimeEnvText, warnings: envWarnings, stderr: wslRuntimeEnv.stderr || undefined },
    ),
  );

  const wslGithub = wsl(
    "gh auth status --hostname github.com 2>&1 | sed -e 's/Token: .*/Token: <redacted>/' -e 's/[A-Za-z0-9_\\-]\\{30,\\}/<redacted>/g' | head -20",
    { timeoutMs: 25_000 },
  );
  checks.push(
    check(
      "wsl-github-cli",
      wslGithub.ok && /Logged in to github\.com/.test(wslGithub.stdout) ? "OK" : "WARN",
      wslGithub.ok ? "GitHub CLI auth is visible from WSL" : "GitHub CLI auth did not verify from WSL",
      wslGithub,
    ),
  );

  const wslPathsScript = projectPaths
    .map((winPath) => {
      const wslPath = winPath.replace(/^D:/, "/mnt/d").replaceAll("\\", "/");
      return `[ -d '${wslPath}' ] && printf 'OK ${wslPath}\\n' || printf 'MISSING ${wslPath}\\n'`;
    })
    .join("; ");
  const wslPaths = wsl(wslPathsScript, { timeoutMs: 10_000 });
  const missingProjects = wslPaths.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("MISSING"));
  checks.push(
    check(
      "wsl-project-paths",
      wslPaths.ok && missingProjects.length === 0 ? "OK" : "FAIL",
      missingProjects.length === 0 ? "WSL can see active D: Theseus projects" : "WSL cannot see every active D: Theseus project",
      { stdout: wslPaths.stdout, missing: missingProjects, stderr: wslPaths.stderr || undefined },
    ),
  );

  const wslNativeDocker = wsl(
    [
      "[ -S /var/run/docker.sock ] && echo docker_socket=present || echo docker_socket=missing",
      "docker context show 2>&1 | sed 's#^#docker_context=#'",
      "docker version --format '{{.Server.Version}}' 2>&1 | sed 's#^#docker_server=#'",
    ].join("; "),
    { timeoutMs: 15_000 },
  );
  const nativeDockerReady = wslNativeDocker.ok && /docker_socket=present/.test(wslNativeDocker.stdout) && /docker_server=/.test(wslNativeDocker.stdout);
  checks.push(
    check(
      "wsl-native-docker",
      nativeDockerReady ? "OK" : "FAIL",
      nativeDockerReady
        ? "WSL reaches Docker Desktop through /var/run/docker.sock"
        : "WSL native Docker socket or Docker CLI did not verify",
      wslNativeDocker,
    ),
  );

  const wslProbe = wsl(`node ${observatoryProbeWsl}`, { timeoutMs: 20_000 });
  const wslProbeSummary = summarizeDockerProbe(wslProbe.stdout);
  checks.push(
    check(
      "wsl-legacy-docker-proxy",
      nativeDockerReady || (wslProbe.ok && wslProbeSummary.verdict === "OK") ? "OK" : "WARN",
      wslProbe.ok && wslProbeSummary.verdict === "OK"
        ? "Optional legacy Docker proxy also works from WSL"
        : nativeDockerReady
          ? "N/A: legacy proxy is not required because the native Docker socket works"
          : "Legacy Docker proxy did not verify; native socket remains the preferred route",
      { ...wslProbeSummary, native_docker_ready: nativeDockerReady, stderr: wslProbe.stderr || undefined },
    ),
  );

  const sshAgent = wsl(
    [
      "command -v ssh-agent | sed 's#^#ssh_agent=#'",
      "command -v ssh-add | sed 's#^#ssh_add=#'",
      "[ -S \"$SSH_AUTH_SOCK\" ] && echo ssh_auth_sock_socket=1 || echo ssh_auth_sock_socket=0",
      "ssh-add -l 2>&1 | sed -e 's/[A-Za-z0-9+\\/=]\\{20,\\}/<redacted>/g' | head -5",
    ].join("; "),
    { timeoutMs: 10_000 },
  );
  const hasAgentSocket = /ssh_auth_sock_socket=1/.test(sshAgent.stdout);
  const canListKeys = /SHA256:|The agent has no identities/.test(sshAgent.stdout);
  checks.push(
    check(
      "wsl-ssh-agent",
      hasAgentSocket && canListKeys ? "OK" : "WARN",
      hasAgentSocket
        ? "WSL SSH agent socket is visible"
        : "WSL SSH agent is installed but no active SSH_AUTH_SOCK is visible",
      sshAgent,
    ),
  );

  const ubuntuVmSsh = wsl(
    "ssh -o BatchMode=yes -o ConnectTimeout=5 theseus-ubuntu-vm 'echo ssh-ok; whoami; hostname' > /tmp/theseus-ubuntu-vm-ssh.log 2>&1; status=$?; sed -e 's/[A-Za-z0-9+\\/=]\\{20,\\}/<redacted>/g' /tmp/theseus-ubuntu-vm-ssh.log | head -20; exit $status",
    { timeoutMs: 12_000 },
  );
  checks.push(
    check(
      "wsl-ubuntu-vm-ssh",
      ubuntuVmSsh.ok && /ssh-ok/.test(ubuntuVmSsh.stdout) ? "OK" : "WARN",
      ubuntuVmSsh.ok ? "WSL can connect to Ubuntu VM through SSH alias" : "WSL SSH alias to Ubuntu VM did not verify",
      ubuntuVmSsh,
    ),
  );

  const vscode = wsl(
    [
      "command -v code | sed 's#^#code=#' || true",
      "[ -d '/mnt/d/theseus-observatory/.vscode' ] && echo vscode_project_tasks=observatory || true",
      `[ -d '${repoRoot.replace(/^C:/, "/mnt/c").replaceAll("\\", "/")}/.vscode' ] && echo vscode_project_tasks=monolith || true`,
    ].join("; "),
    { timeoutMs: 10_000 },
  );
  checks.push(
    check(
      "wsl-vscode-bridge",
      /code=/.test(vscode.stdout) ? "OK" : "WARN",
      /code=/.test(vscode.stdout)
        ? "VS Code CLI is visible from WSL"
        : "VS Code CLI is not visible from WSL; Remote WSL task route may need setup",
      vscode,
    ),
  );

  const projectHooks = readMaybeJson(path.join(repoRoot, ".codex", "hooks.json"));
  const globalHooks = readMaybeJson("C:/Users/s.poklad/.codex/hooks.json");
  checks.push(
    check(
      "codex-hooks-json",
      projectHooks.parse_ok && (!globalHooks.exists || globalHooks.parse_ok) ? "OK" : "WARN",
      globalHooks.exists ? "Project and global Codex hooks JSON parse check" : "Project Codex hooks JSON parses; no global duplicate layer",
      {
        project: { exists: projectHooks.exists, parse_ok: projectHooks.parse_ok, error: projectHooks.error },
        global: { exists: globalHooks.exists, parse_ok: globalHooks.parse_ok, error: globalHooks.error },
      },
    ),
  );

  const configScan = scanText("C:/Users/s.poklad/.codex/config.toml", [
    { label: "windows-monolith-path", regex: /C:\\Users\\s\.poklad\\Documents\\Codex\\2026-07-08/g },
    { label: "raw-docker-2375", regex: /127\.0\.0\.1:2375/g },
    { label: "code-home-sqlite", regex: /CODEX_SQLITE_HOME|sqlite_home/gi },
  ]);
  checks.push(
    check(
      "codex-global-config-portability",
      configScan.hits.length ? "WARN" : "OK",
      configScan.hits.length
        ? "Global Codex config still has Windows-local or raw Docker assumptions"
        : "No obvious WSL portability markers found in global config",
      configScan,
    ),
  );

  const tasksScan = scanText(path.join(repoRoot, ".vscode", "tasks.json"), [
    { label: "raw-docker-2375", regex: /127\.0\.0\.1:2375/g },
    { label: "wsl-command", regex: /"wsl"|"wsl\.exe"/gi },
    { label: "legacy-monolith-path", regex: /C:\\Users\\s\.poklad\\Documents\\Codex\\2026-07-08/g },
  ]);
  checks.push(
    check(
      "vscode-task-portability",
      tasksScan.hits.some((hit) => hit.pattern === "raw-docker-2375" || hit.pattern === "legacy-monolith-path")
        ? "WARN"
        : "OK",
      "VS Code task portability scan",
      tasksScan,
    ),
  );

  const issueFindings = [
    {
      issue: 31426,
      url: "https://github.com/openai/codex/issues/31426",
      finding: "CODEX_HOME on /mnt/c can break WSL SQLite/socket state initialization.",
      local_mitigation: "Use WSL-native CODEX_HOME/cache before agent migration; do not run runtime state from DrvFS.",
    },
    {
      issue: 18506,
      url: "https://github.com/openai/codex/issues/18506",
      finding: "UNC cwd and Windows config leaking into WSL are known failure classes.",
      local_mitigation: "Keep config/runtime paths explicit per context and verify cwd before relying on hooks/tasks.",
    },
    {
      issue: 32733,
      url: "https://github.com/openai/codex/issues/32733",
      finding: "Windows TEMP/TMP forwarded through WSLENV can break Linux tooling on DrvFS.",
      local_mitigation: "Preflight should flag TEMP/TMP leakage and prefer WSL-native temp/cache paths.",
    },
    {
      issue: 31049,
      url: "https://github.com/openai/codex/issues/31049",
      finding: "WSL-native mode can hide Chrome bridge and pass Windows attachment paths to Linux agent.",
      local_mitigation: "Treat browser/computer-use bridges as Windows-context tools unless WSL mapping is proven.",
    },
  ];

  const overall = checks.reduce((acc, item) => (statusRank(item.status) > statusRank(acc) ? item.status : acc), "OK");
  const report = {
    generated_at: new Date().toISOString(),
    status: overall,
    recommendation:
      overall === "FAIL"
        ? "fix failing WSL bridge checks before moving the agent runtime"
        : overall === "WARN"
          ? "migration is possible only as a guarded pilot; fix warnings before making WSL default"
          : "preflight passed; WSL pilot can proceed with checkpointing",
    checks,
    issue_findings: issueFindings,
  };
  if (args.write) {
    const outDir = path.join(repoRoot, "outputs", "wsl_migration_preflight");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (overall === "FAIL") exit(1);
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
