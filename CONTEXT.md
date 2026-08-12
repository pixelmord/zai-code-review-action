# Context

Glossary for `zai-code-review-action`. Terms only — no implementation detail, no decisions. Decisions
live in [`docs/adr/`](./docs/adr/) and on the [wayfinder
map](https://github.com/pixelmord/zai-code-review-action/issues/2).

## Finding

One reviewable observation about one line of the pull request: a severity, a message, an optional
suggestion, and the location it applies to. The unit of everything — the model emits findings, the
action posts findings, reconciliation carries findings between runs.

## Severity

The weight of a finding: `critical`, `major`, `minor`, `nit`. Fixed set, ordered. Not a priority and
not a confidence — severity says how bad the thing is if real, nothing about how sure the model is.

## Review

The single artifact the action posts per run: a body plus a set of inline comments. One review per
run, never more. Distinct from a *finding* — a review is how findings become visible.

## Anchoring

Attaching a finding to a specific line of a specific file so it appears as an inline comment.
Anchoring can fail; the finding still exists.

## Commentable line

A line the pull request's diff actually exposes for comment. Not every line of a changed file is
commentable, so a finding can name a real line that cannot carry a comment.

## Unanchored finding

A finding that survived validation but could not be anchored. It is reported in the review body
instead of as an inline comment. Never silently dropped — "unanchored" is a rendering outcome, not a
rejection.

## Dropped finding

A finding rejected before posting because its shape was invalid. Distinct from *unanchored*: dropped
means "not a usable finding", unanchored means "a usable finding with nowhere to sit".

## Run

One execution of the action against one pull request at one head commit. A pull request accumulates
runs as it is pushed to.

## Run outcome

The action's terminal classification of a run for downstream automation. It describes whether the
review was completed, skipped, unavailable, or failed; it is distinct from the findings a completed
review reports.

## Reconciliation

Deciding, on a run after the first, which findings from the previous run still apply. Produces
*carried-forward* and *resolved* findings, plus whatever is *new*. It is a judgement the model makes,
not a diff the action computes.

## Carried-forward finding

A finding from the previous run that the current run judges still valid. Keeps its identity across
runs even when its line number moves.

## Resolved finding

A finding from the previous run that the current run judges no longer applies. Reported explicitly —
a finding's mere absence is not resolution, because absence can also mean the model missed it.

## Review state

The record of what the previous run reported, carried on the pull request itself so the next run can
reconcile against it. The pull request is the only store; the action keeps nothing between runs.

## Tombstone

What a superseded review's body becomes once its successor is posted: a marker that it no longer
speaks for the current state of the pull request.

## Intent

What the pull request says about itself — its title and body — supplied to the model so it can judge
whether a change is deliberate. Untrusted by definition.

## Untrusted region

Any part of the prompt that a pull request author controls: the diff, the intent, a repo-defined
prompt file. It is *data* the model reads, never instruction the model follows.

## Standard prompt

The review guidance the action ships with. A repository may replace part of it; the output contract
is never part of what can be replaced.
