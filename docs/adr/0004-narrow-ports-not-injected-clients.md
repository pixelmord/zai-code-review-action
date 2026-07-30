---
status: accepted
---

# The pipeline depends on narrow ports, not on Octokit and an HTTP client

The action defines two interfaces of its own — `ReviewGateway` (every GitHub call it makes) and
`ReviewModel` (`complete(prompt) → text`) — and the review pipeline depends only on those. Octokit and
the z.ai `fetch` call live in adapters behind them, wired up at the entrypoint.

The obvious alternative, and the one
[`openai/codex-action`](../research/codex-action-comparison.md) uses, is to inject the real client:
`ensureActorHasWriteAccess(…, octokit?: Octokit)`. That is enough for its two tested units, but it
makes every fake a partial object needing an `as unknown as Octokit` cast, and it leaves the set of
API calls the action actually makes scattered across call sites.

Two things make the narrow port worth the extra indirection here:

- **The port is the `permissions:` contract.** ADR-adjacent decision
  [#19](https://github.com/pixelmord/zai-code-review-action/issues/19) makes *requiring a new
  `permissions:` scope* a breaking change, because a consumer pinned to `@v1` gets a silent 403
  otherwise. `ReviewGateway` is the one place that list can be read off and reviewed before a release.
- **It puts transport concerns where they belong.** Retry, backoff and timeout are adapter behaviour;
  the pipeline should be unable to express them. Likewise the parse ladder
  ([#16](https://github.com/pixelmord/zai-code-review-action/issues/16)) operates on a string from
  `ReviewModel`, so its tests never touch HTTP.

## Consequences

- Test fakes are hand-rolled objects implementing the ports, recording `{method, args}`; no casts, no
  `vi.mock`, no msw/nock. Wire-level mocking was rejected because such fixtures drift from the real
  API silently.
- The pipeline can be run end to end in-process against fakes, which is how the ordering decisions
  (post-then-clean from [#17](https://github.com/pixelmord/zai-code-review-action/issues/17); filter →
  patch-availability → `max-diff-chars` from
  [#18](https://github.com/pixelmord/zai-code-review-action/issues/18)) get asserted at all — unit
  tests cannot see call ordering.
- Adding a GitHub call means widening `ReviewGateway` deliberately, which is the point.
- Cost: one more layer between the pipeline and Octokit's types, and a port that must be kept honest
  by hand — there is no compiler check that the adapter's real calls match the declared surface.
