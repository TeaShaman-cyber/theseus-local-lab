# Skills Priority Research Mini-Dataset

Date: 2026-07-12
Project: Theseus local lab
Purpose: compact source-backed notes for future Codex runs about Codex/Agent Skills, priority, trigger behavior, and fragility.

## Executive Summary

Codex skills are not a strict priority system. They are a progressive-disclosure routing layer:

1. Codex initially sees skill metadata: `name`, `description`, and path.
2. Codex loads full `SKILL.md` only after it decides a skill is relevant.
3. The main implicit trigger is the `description` field.
4. Explicit `$skill` invocation is the strongest practical user-level selection signal.
5. `agents/openai.yaml` can configure UI metadata, tool dependencies, and `policy.allow_implicit_invocation`.
6. If many skills are installed, the initial skill list can be shortened or partly omitted, so broad skill catalogs become brittle.
7. No public source found a simple numeric `priority` field for Codex skills.

Practical conclusion for Theseus: build a small meta-skill that routes tool choice and safety policy, but do not rely on it to override all other skills. Reinforce critical behavior with deterministic wrappers, VS Code tasks, hooks, and MCP/tool dependencies.

## Source Notes

### OpenAI: Build Skills

URL: https://developers.openai.com/codex/skills

Relevant findings:

- Codex uses progressive disclosure: starts with each skill name, description, and file path, then loads full `SKILL.md` only when it decides to use a skill.
- The initial skill list has a context budget: up to 2% of the model context window, or 8,000 characters when unknown.
- If many skills exist, descriptions may be shortened first; for large skill sets, some skills may be omitted from the initial list.
- Skills activate explicitly by `$skill` mention, or implicitly when the task matches `description`.
- `description` should front-load key use cases and trigger words because shortening can affect matching.
- Codex reads repository, user, admin, and system skill locations.
- If two skills share the same `name`, Codex does not merge them; both can appear.
- `agents/openai.yaml` can include `policy.allow_implicit_invocation: false`, while explicit invocation still works.
- Best practices: one job per skill, imperative steps, explicit inputs/outputs, test prompts against the description.

Implication:

- `description` is the highest-leverage field for automatic selection.
- A meta-skill should include concrete trigger phrases like "GitHub sync", "git safety", "VS Code task first", "secret-safe push", "advisor route", "avoid raw PowerShell".
- If the behavior is safety-critical, do not rely on implicit skill selection alone.

### OpenAI: Customization Overview

URL: https://developers.openai.com/codex/concepts/customization

Relevant findings:

- Durable customization layers are distinct:
  - `AGENTS.md` for persistent project instructions.
  - Memories for useful learned context.
  - Skills for reusable workflows and domain expertise.
  - MCP for external tools and shared systems.
  - Subagents for delegated specialized work.
- Skills are recommended for repeatable workflows, team-specific expertise, and procedures needing examples, references, or helper scripts.
- Skills can be global or repo-specific.
- MCP is often most useful when paired with skills: the skill defines workflow and names the MCP tools to use.

Implication:

- Our Git/process problem is not solved by one layer:
  - `AGENTS.md`: general repo rules.
  - `theseus-git-hygiene` skill: reusable workflow and routing.
  - VS Code tasks and hooks: deterministic enforcement.
  - MCP/GitHub connector: live external actions.
  - Advisor/conclave: second opinions, not authority.

### OpenAI: Save Workflows As Skills

URL: https://developers.openai.com/codex/use-cases/reusable-codex-skills

Relevant findings:

- Skills preserve repeatable instructions, resources, scripts, commands, examples, and good outcomes.
- A skill should start from one working example.
- Codex can create and validate the skill, then update it after real use.
- Corrections from a future task should be added back into the skill when it uses the wrong command, misses a rule, skips a step, or produces the wrong style.

Implication:

- Treat `theseus-git-hygiene` as a living skill.
- When Codex relapses into raw PowerShell, records wrong priority, or bypasses VS Code tasks, update the skill with the concrete failure pattern.

### Agent Skills Open Specification

URL: https://agentskills.io/

Relevant findings:

- Agent Skills are a lightweight open format for specialized knowledge and workflows.
- A skill is a folder containing `SKILL.md` with at least `name` and `description`.
- Skills can bundle `scripts`, `references`, `assets`, and other resources.
- Progressive disclosure has three stages:
  - Discovery: load name and description.
  - Activation: read full `SKILL.md` when task matches.
  - Execution: follow instructions and optionally use bundled code/resources.
- The format was developed by Anthropic, released as an open standard, and adopted by multiple products.

Implication:

- Keep our skills portable where possible.
- Avoid Codex-only assumptions in core process descriptions unless the behavior is truly Codex-specific.

### OpenAI Local Skill-Creator

Local source: `C:\Users\s.poklad\.codex\skills\.system\skill-creator\SKILL.md`

Relevant findings:

- Frontmatter `name` and `description` are the only fields Codex reads to determine when the skill gets used.
- The body is loaded only after the skill triggers.
- `agents/openai.yaml` is recommended for UI metadata, default prompt, and dependency declaration.
- Scripts should be used when deterministic reliability is needed.
- References should be loaded only when needed.
- Keep `SKILL.md` body lean and under about 500 lines.
- Put "when to use" information in `description`, not only in the body.

Implication:

- The first line of defense against wrong skill choice is description engineering.
- The second line is deterministic task/wrapper design.
- The third line is explicit user invocation or project-level routing.

### Security: Semantic Supply-Chain Attacks On SKILL.md

URL: https://arxiv.org/abs/2605.11418

Relevant findings:

- SKILL.md is operational text, not passive documentation.
- Natural-language metadata and instructions can affect which skills are admitted, surfaced, selected, and loaded.
- The paper studies SKILL.md-only attacks across discovery, selection, and governance.
- Reported results include:
  - Discovery manipulation up to 86% pairwise win rate and 80% top-10 placement.
  - Selection manipulation through description framing, with adversarial variants selected in 77.6% of paired trials on average.
  - Governance evasion from 36.5% to 100% depending on strategy.

Implication:

- Third-party skills should be treated like supply-chain dependencies.
- Natural-language descriptions are security-sensitive.
- Do not install or trust skills only because they look useful.
- Review `SKILL.md`, scripts, references, and dependency declarations.
- Keep secrets outside skill folders.
- Prefer signed/known/local skills for high-trust workflows.

### Tavily / Exa / Parallel / Acumen Pipeline Notes

Observed in this task:

- Exa quickly found the official OpenAI `Agent Skills` page and GitHub source snippets.
- Parallel Search returned broad ecosystem and official OpenAI customization results.
- Tavily found the arXiv security paper and useful security summaries.
- Acumen by Talarion was available only after tool discovery and was not precise for this narrow skills topic; its first responses drifted into broader AI/cybersecurity events.

Implication:

- For future "deep research lite":
  1. Use official OpenAI route first for Codex product claims.
  2. Use Exa for semantically targeted official/source discovery.
  3. Use Parallel Search for broad ecosystem coverage.
  4. Use Tavily for current web/security/news and extraction.
  5. Use Acumen as a recency guardrail, not as the only source for narrow technical facts.

## Priority Model For Theseus

This is a practical model, not an official hidden priority table.

1. System/developer instructions: highest authority.
2. User's current request: task direction.
3. Explicit skill invocation: `$skill-name` or named skill in prompt.
4. Loaded skill instructions: once selected, they guide the workflow.
5. Skill metadata: `name`, `description`, path, and visibility in current context.
6. `agents/openai.yaml`: UI metadata, dependency declarations, and implicit invocation policy.
7. Repo instructions and project files: `AGENTS.md`, hooks, tasks, helper scripts.
8. Tool availability and sandbox: what can actually be called in this task.
9. Model memory/general knowledge: useful but less reliable than current sources.

## Design Rules For Our Git Meta-Skill

1. Description must say exactly when to trigger:
   - GitHub sync.
   - Commit/push.
   - Secret-safe Git work.
   - VS Code task first.
   - Copilot/conclave advisor route.
   - Avoid raw PowerShell when a wrapper/task/MCP path exists.

2. Body should start with a fast interrupt:
   - Is there a VS Code task?
   - Is there an MCP connector?
   - Is there a repo helper script?
   - Does this touch secrets?
   - Does this require GitHub network/auth?

3. Deterministic behavior should live outside prose:
   - `.vscode/tasks.json`
   - `tools/git_safety/scan_staged.mjs`
   - `.githooks/pre-commit`
   - provider env wrappers
   - session journal tools

4. Avoid overlapping broad skills:
   - One skill should own Git hygiene.
   - One skill should own local infra hygiene.
   - If overlap is unavoidable, skills should state the sequencing rule.

5. Use explicit invocation for fragile work:
   - `$theseus-git-hygiene`
   - `$local-agent-hygiene`
   - `$skill-creator`

6. Do not try to win by verbosity:
   - Large descriptions may be shortened.
   - Large skill catalogs may omit skills.
   - Put the highest-signal trigger words first.

## Fragility Checklist

Before trusting a skill or skill change:

- Does `description` include both "use when" and "do not use when" boundaries?
- Would it still trigger if shortened to the first sentence?
- Does it conflict with another skill's trigger?
- Are scripts deterministic and small?
- Are secrets excluded?
- Are external tools declared in `agents/openai.yaml` if needed?
- Is there a fallback when MCP/connector/tool exposure is lazy or absent?
- Was the skill tested with a prompt that previously caused a failure?
- Is the workflow reinforced by a hook/task/wrapper when failure would be costly?

## Open Questions

- Exact internal ranking among multiple matching Codex skills is not publicly specified in the sources checked.
- Current desktop/project behavior may differ from CLI docs in edge cases, especially after restarts or tool/plugin exposure changes.
- Repo-specific skill auto-discovery path in current ChatGPT Work/Codex desktop should be tested directly in this project; official docs mention `.agents/skills`, while this repo currently also keeps `skills/` as source material.
- Acumen and Tavily may require `tool_search` discovery before callable tools appear in a session.

## Recommended Next Step

Update `theseus-git-hygiene` so its description front-loads the exact failure class:

> Use for Theseus GitHub sync, commit, push, and secret-safe Git work; before raw git/PowerShell, prefer VS Code tasks, repo helper scripts, hooks, GitHub connector/plugin, and advisor routes.

Then add a repo `.agents/skills/theseus-git-hygiene` copy or link strategy if current Codex desktop recognizes `.agents/skills` more reliably than `skills/`.
