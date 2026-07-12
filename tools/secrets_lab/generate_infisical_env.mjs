#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "secrets-lab");
const targetPath = path.join(targetDir, ".env");

if (!fs.existsSync(targetDir)) {
  throw new Error(`Missing directory: ${targetDir}`);
}

if (fs.existsSync(targetPath) && !process.argv.includes("--force")) {
  console.log("secrets-lab/.env already exists; leaving it unchanged.");
  console.log("Pass --force to regenerate local instance secrets.");
  process.exit(0);
}

const encryptionKey = crypto.randomBytes(16).toString("hex");
const authSecret = crypto.randomBytes(32).toString("base64");
const postgresPassword = crypto.randomBytes(24).toString("base64url");

const content = `# Generated locally. Do not commit.
INFISICAL_PORT=8088
SITE_URL=http://localhost:8088

ENCRYPTION_KEY=${encryptionKey}
AUTH_SECRET=${authSecret}

POSTGRES_USER=infisical
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=infisical
DB_CONNECTION_URI=postgres://infisical:${postgresPassword}@db:5432/infisical

REDIS_URL=redis://redis:6379
NODE_ENV=production
OTEL_TELEMETRY_COLLECTION_ENABLED=false
`;

fs.writeFileSync(targetPath, content, { encoding: "utf8", mode: 0o600 });
console.log("Created secrets-lab/.env with generated local instance secrets.");
console.log("Values were not printed. Keep this file backed up and out of Git.");
