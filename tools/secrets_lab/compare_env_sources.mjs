import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const envLocalPath = path.join(repoRoot, ".env.local");
const names = process.argv.slice(2);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const data = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const rawLine of data.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    out[key] = value;
  }
  return out;
}

function describe(value) {
  if (!value) {
    return {
      present: false,
      length: 0,
      containsUrl: false,
      startsWithHttp: false,
      hasWhitespace: false,
    };
  }

  return {
    present: true,
    length: value.length,
    containsUrl: /https?:\/\//i.test(value),
    startsWithHttp: /^https?:\/\//i.test(value),
    hasWhitespace: /\s/.test(value),
  };
}

const local = parseEnvFile(envLocalPath);
const result = names.map((name) => {
  const localValue = local[name] || "";
  const injectedValue = process.env[name] || "";
  return {
    name,
    local: describe(localValue),
    injected: describe(injectedValue),
    equal: localValue !== "" && injectedValue !== "" && localValue === injectedValue,
  };
});

console.log(JSON.stringify({ envLocalPresent: fs.existsSync(envLocalPath), result }, null, 2));
