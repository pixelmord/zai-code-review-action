---
status: accepted
---

# Review state lives in a hidden JSON block in the review body

Cross-run reconciliation needs the previous run's findings back as structured data. Rather than
reverse-parsing its own rendered inline comments, the action writes
`<!-- zai-review-state:{"v":1,"headSha":…,"findings":[…]} -->` into the review body and reads it back
on the next run. The pull request is the only store — the action keeps no state anywhere else, so it
needs no database, no cache, and no artifact retention.

Hard to reverse: it is a wire format written into permanent PR history, and `v` exists precisely so a
future shape change can be detected rather than misread.

## Considered options

- **Regex the rendered comments.** Rejected: it would promote the severity rendering (emoji + bold
  label) from a presentation choice into a parsing contract, and unanchored findings live in the body
  rather than as comments, so they would be lost.
- **A separate sticky issue comment.** Rejected: a second artifact to find, guard and paginate for, in
  exchange for a marginally tidier timeline.

## Consequences

- Exactly one state block may exist per pull request, which is why a superseded review's body is
  tombstoned (marker stripped) rather than left in place.
- `suggestion` text is deliberately excluded from the state to keep the block small; a carried-forward
  finding gets a fresh suggestion each run anyway.
- An unreadable or unknown-version block degrades to "review from scratch", never to a hard failure.
