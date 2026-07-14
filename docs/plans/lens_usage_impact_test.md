# Lens Usage Impact Test

Goal: measure whether OCR Lens and Source Lens reduce Codex usage burn for
research and document-reading work.

This is an observability test, not a benchmark leaderboard. Do not optimize for
a prettier number without checking task quality.

## Hypothesis

Using a lens before deep reading reduces:

- repeated full-document/page reads;
- context-window pressure;
- manual re-reading after compaction;
- weekly usage burn for the same research outcome.

## Test Shape

Use paired tasks with similar difficulty:

```text
A. baseline route
   direct reading/search review without source_lens or ocr_lens

B. lens route
   source_lens / ocr_lens first
   read only ranked sections/sources next
   create optional memory draft when the finding is durable
```

## Capture Before And After

For each run, record:

- task id and short goal;
- model and reasoning effort;
- visible usage percentage before and after;
- context percentage before and after when visible;
- source size and lens size;
- number of deep reads opened after the lens;
- final output quality notes;
- whether a memory draft was created;
- whether the agent needed to re-read the same source later.

Use:

```text
node tools/usage_scout/usage_scout.mjs
node tools/source_lens/source_lens.mjs <source> --query "<goal>" --write --memory-draft
node tools/ocr_lens/ocr_lens.mjs <document> --write
node tools/lens_usage_trial/lens_usage_trial.mjs start --trial <id> --route lens --goal "<goal>" --lens outputs/source_lens/latest.json
node tools/lens_usage_trial/lens_usage_trial.mjs end --trial <id> --route lens --quality "<quality note>" --lens outputs/source_lens/latest.json --artifact <result.md> --deep-reads <n>
node tools/lens_usage_trial/lens_usage_trial.mjs report --trial <id>
node tools/session_timeline/timeline.mjs add ...
```

Prefer `lens_usage_trial` for paired measurements. It records:

- start/end usage snapshots;
- visible weekly-limit percent delta;
- session cumulative token delta from the rollout stream;
- lens compression metrics when a lens JSON path is supplied;
- result artifact metadata without reading the artifact body;
- deep-read count after the lens;
- a quality note so reduced usage cannot count as success by itself.

## Success Criteria

A lens route is useful only if it improves at least one of:

- lower visible usage delta for comparable task;
- lower context pressure;
- fewer repeated reads;
- faster recovery after compaction;
- better source prioritization with no quality loss.

## Anti-Goodhart Guard

Do not count token reduction alone as success.

Reject a lens route when it:

- hides important dissenting sources;
- strips dates, provenance, or links;
- creates false confidence from weak snippets;
- stores noisy search output in durable memory;
- causes the agent to skip necessary deep verification.

## First Practical Trial

Use the OpenAI Codex issue watch and provider-failure research:

```text
baseline:
  read issue/search output directly and answer

lens:
  build Source Lens from outputs/github_issue_watch/openai-codex.json
  inspect ranked route
  deep-read only top candidates
  compare usage delta and answer quality
```
