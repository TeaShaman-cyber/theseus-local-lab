#!/usr/bin/env node

import fs from 'node:fs';

const messagePath = process.argv[2];
if (!messagePath) {
  console.error('commit provenance: missing commit message path');
  process.exit(2);
}

const message = fs.readFileSync(messagePath, 'utf8');
const fields = [
  'Agent-Persona',
  'Harness',
  'Provider',
  'Model',
  'Session-Ref',
];
const lines = new Map();

for (const line of message.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*?)\s*$/);
  if (match && !lines.has(match[1])) {
    lines.set(match[1], match[2]);
  }
}

const present = fields.filter((field) => lines.has(field));
if (present.length === 0) {
  process.exit(0);
}

const missing = fields.filter((field) => !lines.get(field));
if (missing.length > 0) {
  console.error('commit provenance: incomplete agent provenance trailers');
  console.error(`  present: ${present.join(', ')}`);
  console.error(`  missing or empty: ${missing.join(', ')}`);
  console.error('  expected: Agent-Persona, Harness, Provider, Model, Session-Ref');
  process.exit(1);
}

console.log('commit provenance: trailers complete');
