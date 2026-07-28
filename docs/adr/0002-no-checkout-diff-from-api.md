---
status: accepted
---

# The action never checks out the pull request

The diff comes from `GET /repos/{owner}/{repo}/pulls/{number}` with
`Accept: application/vnd.github.v3.diff` (plus `listFiles` for per-file patches and status), so no
`actions/checkout` step is required or wanted. Consequence: attacker-controlled files never reach the
runner, which is what makes it safe for a single job to hold both the z.ai API key and
`pull-requests: write`.

This is a deliberate deviation from the obvious path — every review action example starts with
`actions/checkout`, and a future reader will assume its absence is an oversight. It is not.
[`openai/codex-action`](../research/codex-action-comparison.md) reaches for the weaker version of the
same goal by keeping its agent job at `contents: read` and posting from a second job; it cannot go
further because its agent needs the files.

## Consequences

- The consuming workflow is a single step with no checkout, no install, no build.
- Whole-file context is unavailable by construction, reinforcing ADR 0001's accepted limitation.
- A repo-defined prompt file cannot be read from disk; it must be fetched via the contents API at an
  explicitly chosen ref — which turns the prompt-file trust boundary into an explicit parameter rather
  than a property of whatever the workflow happened to check out.
