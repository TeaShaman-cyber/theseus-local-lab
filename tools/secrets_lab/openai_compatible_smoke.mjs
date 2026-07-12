const provider = process.argv[2] || "BOTHUB";

const keyName = `${provider}_API_KEY`;
const baseName = `${provider}_BASE_URL`;
const modelName = `${provider}_MODEL`;

const apiKey = process.env[keyName];
const baseUrl = process.env[baseName];
const model = process.env[modelName];

if (!apiKey || !baseUrl || !model) {
  console.log(JSON.stringify({
    ok: false,
    provider,
    missing: [keyName, baseName, modelName].filter((name) => !process.env[name]),
  }, null, 2));
  process.exit(1);
}

const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Reply exactly: provider-ok" }],
    max_tokens: 20,
    temperature: 0,
  }),
});

let body;
try {
  body = await response.json();
} catch {
  body = {};
}

const text = body?.choices?.[0]?.message?.content;
console.log(JSON.stringify({
  ok: response.ok,
  provider,
  status: response.status,
  model,
  response: response.ok ? text : undefined,
  errorType: response.ok ? undefined : body?.error?.type,
  errorCode: response.ok ? undefined : body?.error?.code,
  errorMessage: response.ok ? undefined : String(body?.error?.message || "").slice(0, 220),
}, null, 2));

if (!response.ok) {
  process.exit(1);
}
