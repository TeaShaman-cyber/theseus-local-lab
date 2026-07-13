# Tool Policy Pattern Analysis 2026-07-13

Scope: local Theseus logs, project notes, AutoMem recall, and the first
`outputs/tool_policy` event.

## Repeated Friction Patterns

1. Docker context split
   - Symptom: direct Docker CLI can fail from Codex even when Docker Desktop is
     healthy for the normal Windows user.
   - Evidence: repeated notes about `CodexSandboxOffline`, Docker named pipe
     permission, Docker config ACL, WSL/user context mismatch.
   - Policy response: block raw Docker shell; route to Docker MCP/TCP bridge or
     VS Code Docker tasks.

2. PowerShell as a fragile default
   - Symptom: quoting, interpolation, script launch, and long command strings
     repeatedly create avoidable friction.
   - Evidence: PowerShell interpolation bug, repeated preference for Git Bash,
     Node wrappers, Docker agent-shell, and VS Code tasks.
   - Policy response: block raw PowerShell scripts unless wrapped as an explicit
     task or replaced by a Node wrapper.

3. Broad Git actions
   - Symptom: broad staging/publishing can accidentally include generated files,
     secrets, raw logs, or unrelated work.
   - Evidence: git meta-skill and secret-scan workflow emphasize explicit scope,
     staged scan, and user-approved checkpoint/push.
   - Policy response: block `git add -A`, allow read-only Git inspection and
     known git safety wrappers.

4. Split runtime proof
   - Symptom: config presence is often mistaken for runtime proof.
   - Evidence: WSL sandbox notes show that normal user WSL and Codex WSL can see
     different write access, Docker access, and localhost behavior.
   - Policy response: prefer smoke checks and wrapper outputs over assumptions
     from config files.

5. Memory reflex gaps
   - Symptom: memory exists, but may not surface before action unless the task
     explicitly triggers it.
   - Evidence: memory reflex research found rules split across AutoMem, docs,
     skills, hooks, and junior-agent protocol.
   - Policy response: use AutoMem/MemPalace first for Theseus work, then encode
     repeated lessons in executable policy.

## Positive Reinforcement

The policy broker now returns `reinforcement` with every decision:

- `reward +2`: known safe Theseus wrapper route.
- `reward +1`: allowed low-risk route.
- `neutral 0`: caution/warn route.
- `friction -2`: blocked risky route.

This makes the loop non-punitive: the system can count and reward successful
route choices, not only record failures.

## Next Useful Metric

When enough events accumulate in `outputs/tool_policy/*.jsonl`, summarize:

- reward score by day;
- top blocked reasons;
- top repeated safe wrappers;
- ratio of `reward` to `friction`;
- whether the same blocked route repeats after a memory/policy update.

