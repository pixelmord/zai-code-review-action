---
status: accepted
---

# Review via a single chat-completions call, not an agentic runner

Compared against [`openai/codex-action`](../research/codex-action-comparison.md), which installs an
agent CLI and turns it loose on a checkout. We instead send one z.ai `chat/completions` request
containing the diff and require a JSON findings object back. Chosen because an agent's arbitrary tool
use is what forces codex-action to carry a sandbox, a sudo-dropping step, bubblewrap sysctl
workarounds and an API-key proxy — roughly 40% of its code — and because the deterministic JSON
contract is what the line-anchoring and reconciliation designs are built on.

## Consequences

- The model sees only the diff, never the surrounding file. Findings that need whole-file context are
  out of reach; this is the accepted cost.
- Runtime and token cost are bounded and predictable, which matters for a tool that fires on every
  push to every personal repo.
- Prompt injection is inherited; arbitrary code execution on the runner is not. The threat model is
  "the review says something wrong", never "the API key leaves the runner".
