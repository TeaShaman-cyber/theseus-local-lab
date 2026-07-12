const names = process.argv.slice(2);

if (names.length === 0) {
  console.error("Usage: node tools/secrets_lab/check_required_env.mjs NAME...");
  process.exit(2);
}

const result = names.map((name) => ({
  name,
  present: Object.prototype.hasOwnProperty.call(process.env, name)
    && process.env[name] !== "",
}));

const missing = result.filter((item) => !item.present).map((item) => item.name);

console.log(JSON.stringify({ ok: missing.length === 0, result }, null, 2));

if (missing.length > 0) {
  process.exit(1);
}
