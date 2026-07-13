import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const automemEnvPath = path.join(root, "work", "automem", ".env");
const infisicalCli = path.join(
  root,
  "tools",
  "infisical_cli",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "infisical.cmd" : "infisical",
);

function readEnvValue(source, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, "m");
  const match = source.match(pattern);
  return match?.[1]?.trim() ?? "";
}

const source = readFileSync(automemEnvPath, "utf8");
const automemApiUrl = readEnvValue(source, "AUTOMEM_API_URL");
const automemApiKey = readEnvValue(source, "AUTOMEM_API_KEY");

if (!automemApiUrl || !automemApiKey) {
  throw new Error("AUTOMEM_API_URL or AUTOMEM_API_KEY is missing in work/automem/.env");
}

const tempDir = mkdtempSync(path.join(tmpdir(), "theseus-automem-infisical-"));
const tempEnv = path.join(tempDir, "automem.env");

try {
  writeFileSync(
    tempEnv,
    `AUTOMEM_API_URL=${automemApiUrl}\nAUTOMEM_API_KEY=${automemApiKey}\n`,
    { mode: 0o600 },
  );

  const args = [
    "secrets",
    "set",
    "--env=local",
    "--path=/infra",
    "--file",
    tempEnv,
    "--silent",
  ];
  const result =
    process.platform === "win32"
      ? spawnSync(
          `"${infisicalCli}" ${args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`).join(" ")}`,
          { encoding: "utf8", shell: true, timeout: 30_000 },
        )
      : spawnSync(infisicalCli, args, { encoding: "utf8", timeout: 30_000 });

  if (result.status !== 0) {
    const processDetail = [
      result.error ? `error=${result.error.message}` : "",
      result.signal ? `signal=${result.signal}` : "",
      typeof result.status === "number" ? `status=${result.status}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const detail = (result.stderr || result.stdout || "Infisical secret sync failed")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 8)
      .join("\n");
    throw new Error([processDetail, detail].filter(Boolean).join("\n"));
  }

  console.log("infisical-automem-secrets-set-ok");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
