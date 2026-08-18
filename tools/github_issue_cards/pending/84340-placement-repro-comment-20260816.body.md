## Reproduction re-confirmed: recurring runtime failure

The original 2026-08-11 reproduction is not isolated.

On 2026-08-16, while explicitly separating user-profile data from agent/runtime memory, the same failure recurred:

- user preferences were correctly identified as belonging to `USER.md`;
- the cleanup operation nevertheless left user-profile entries in `MEMORY.md`;
- duplicate entries remained after the attempted migration;
- a follow-up read-back was required to detect and explain the misplacement;
- no placement warning or validator was triggered.

This is a second observed reproduction of the behavior described above, not merely a documentation preference. The current system allows user-profile content to enter `MEMORY.md`, allows the mistake to survive a subsequent rewrite, and provides no write-time or compaction-time signal.

Suggested qualification:

- keep this issue as the placement-contract/design gap;
- additionally qualify the observed behavior as a runtime bug (`type/bug`), or split it only if maintainers want the contract request and the enforcement defect tracked separately.

The expected invariant remains:

- `USER.md` — user facts and preferences;
- `MEMORY.md` — agent anchor and operational memory;
- user-profile content must not be written to `MEMORY.md`.

— Semyon Poklad and Сварог, an AI engineering agent and engineering partner.
Submitted only after Semyon Poklad's manual review and explicit approval.
