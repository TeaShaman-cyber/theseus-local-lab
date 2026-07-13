---
name: theseus-copilot-advisor
description: Use when Theseus local-lab work needs a narrow GitHub Copilot second opinion about GitHub, VS Code, GitHub Actions, CI/CD, repository hygiene, GitHub Wiki, Issues, Projects, or Copilot-specific tooling. Route advice through the existing safe Copilot advisor bridge or VS Code task, never by pasting secrets, raw memory, raw transcripts, or backup data.
---

# Theseus Copilot Advisor

Use Copilot as a bounded advisor, not as the primary agent and not as a safety
gate bypass.

## Route

Prefer this order:

1. Use the VS Code task `Theseus: ask Copilot advisor` when the user-facing IDE
   route is available.
2. Use the local bridge when a terminal route is needed:

   ```text
   node tools/copilot_advisor/copilot_advisor.mjs "<safe prompt>"
   ```

3. If the bridge is unavailable, record that boundary and continue with local
   evidence or another advisor route. Do not improvise a broad browser dump.

Read `tools/copilot_advisor/README.md` only when command details, proxy state,
or fallback command shape matter.

## Ask Shape

Send one focused, non-secret prompt. Include:

- the concrete decision or question;
- the relevant public or tracked file names, not file contents unless safe and
  necessary;
- constraints such as "private repo", "no secrets", "small commit", or
  "prefer GitHub-native features";
- the expected output format, for example "give 3 options with tradeoffs".

Good prompts:

- "For a private lab repo, should stable docs be mirrored to GitHub Wiki or kept
  only in tracked docs? Give risks and a minimal rollout."
- "Suggest a minimal GitHub Actions check for markdown and Node script syntax in
  this repo. Do not assume deployment."
- "Review whether GitHub Issues or Projects is a better external kanban mirror
  for this local markdown workflow."

Bad prompts:

- raw `.env` contents;
- API keys, tokens, SSH keys, Infisical exports, or credential screenshots;
- raw AutoMem/MemPalace dumps;
- raw private transcripts or backup archives;
- vague requests like "review the whole repo".

## Use The Answer

Treat Copilot output as advice. Before applying it:

- compare it with local project skills and repository constraints;
- reject any suggestion that bypasses `tools/git_safety/scan_staged.mjs`,
  Infisical/keychain boundaries, or explicit user safety preferences;
- keep adopted changes small and verifiable;
- store durable route changes in AutoMem when they affect future behavior.

For GitHub publication decisions, pair this skill with `theseus-git-hygiene`.
