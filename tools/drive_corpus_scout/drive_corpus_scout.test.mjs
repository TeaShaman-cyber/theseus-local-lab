#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";

import { profileTerms, scoreFile } from "./drive_corpus_scout.mjs";

test("scores TID research files by real matched terms, not extension boost only", () => {
  const profile = {
    extensions: [".gdoc"],
    terms: ["тид", "измер", "динамик", "теория"],
  };
  const terms = profileTerms(profile, "");
  const tidFile = {
    relative_path: "Теория Измерения Динамики (ТИД) в физико-математич... (2).gdoc",
    name: "Теория Измерения Динамики (ТИД) в физико-математич... (2).gdoc",
    stem: "Теория Измерения Динамики (ТИД)",
    ext: ".gdoc",
    modified_at: "2026-06-21T13:48:18.900Z",
  };
  const unrelated = {
    relative_path: "Новый документ.gdoc",
    name: "Новый документ.gdoc",
    stem: "Новый документ",
    ext: ".gdoc",
    modified_at: "2026-07-10T04:46:59.124Z",
  };

  const scoredTid = scoreFile(tidFile, terms, profile);
  const scoredUnrelated = scoreFile(unrelated, terms, profile);

  assert.ok(scoredTid.hits.includes("тид"));
  assert.ok(scoredTid.hits.includes("измер"));
  assert.equal(scoredUnrelated.hits.length, 0);
});

test("scores DeepSeek official export archive as a distinct corpus", () => {
  const profile = {
    extensions: [".json"],
    terms: ["deepseek", "deepssek", "conversations", "архив", "dom_uchenika_maga"],
  };
  const terms = profileTerms(profile, "");
  const exportFile = {
    relative_path: "dom_uchenika_maga\\архив deepssek\\conversations.json",
    name: "conversations.json",
    stem: "conversations",
    ext: ".json",
    modified_at: "1980-01-01T00:00:00.000Z",
  };

  const scored = scoreFile(exportFile, terms, profile);

  assert.ok(scored.hits.includes("conversations"));
  assert.ok(scored.hits.includes("deepssek"));
  assert.ok(scored.score > 10);
});
