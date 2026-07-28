# Comparison: `openai/codex-action`

Read from a shallow clone of [openai/codex-action](https://github.com/openai/codex-action) on
2026-07-28 — `action.yml`, `src/*.ts`, `docs/security.md`, `README.md`, `.github/workflows/ci.yml`,
`package.json`. Everything below is from the source, not from the README's marketing surface.

## What it is (and is not)

A **composite** action that runs an *agent* (`codex exec`) against a checkout. It is not a code
review tool: reviewing is one example workflow in its README, where the agent's free-text
`final-message` output is piped into `issues.createComment` from a **separate job**.

So there is no overlap in review logic — no severity taxonomy, no structured findings, no inline
comments, no reconciliation. The overlap is entirely in **plumbing and threat model**.

## Shape

| | `openai/codex-action` | `zai-code-review-action` |
|---|---|---|
| Action type | composite (bash steps + `dist/main.js` subcommands) | Node20 JS action |
| Model access | agent CLI, arbitrary tool use | one `chat/completions` call |
| Repo access | `actions/checkout` required | none — diff via API |
| Output | free text (`final-message`) | validated JSON findings |
| Posting | caller's job, `issues.createComment` | the action itself, Pulls Review API |
| Structured output | real `codex exec --output-schema` | prompt-level contract only (z.ai has no schema mode) |
| Bundler | esbuild, `dist/` committed | ncc, `dist/` committed |
| Tests | `node --test test/*.test.mjs`, injected Octokit | Vitest, injected clients |

## Why ~40% of its code doesn't apply to us

`src/dropSudo.ts` (342 lines), `writeProxyConfig.ts`, `readServerInfo.ts`, the Responses-API proxy
steps, the bubblewrap/AppArmor sysctl step, and the whole `safety-strategy` input exist for one
reason: **model-authored code executes on the runner**. Its `docs/security.md` spells out the
consequence — with passwordless `sudo` (the GitHub-hosted default), even a read-only-filesystem,
no-network sandbox leaks `OPENAI_API_KEY` via procfs, and it ships
[`examples/test-sandbox-protections.yml`](https://github.com/openai/codex-action/blob/main/examples/test-sandbox-protections.yml)
demonstrating it.

We never execute model output. We inherit prompt injection; we do not inherit code execution.

## What we took

1. **No untrusted code on the runner.** Their strongest structural move is keeping the API-key job at
   `permissions: contents: read` and posting from a second job. We go further and cheaper: fetch the
   diff via `GET /pulls/{n}` with `Accept: application/vnd.github.v3.diff`, no `actions/checkout` at
   all. Attacker-controlled files never reach the runner, so the single job that holds both the z.ai
   key and `pull-requests: write` has nothing hostile to run. See ADR 0002.
2. **Named injection vectors.** `docs/security.md` enumerates PR body HTML comments ("readily
   available to the model but effectively invisible to the user"), individual commit messages, and
   repository instruction files. Our prompt injects PR title/body, so: HTML comments stripped, body
   truncated, untrusted regions fenced with a standing data-not-instructions rule, and reconciliation
   counts always printed so a suppressed review is visible rather than silent.
3. **The `dist` drift gate.** CI rebuilds and fails if `git status --short -- dist` is non-empty. The
   action runs `dist/`, not `src/`, so this is the one failure mode that silently ships stale
   behaviour.
4. **Pinning third-party actions by commit SHA** — they pin `actions/setup-node` to a hash with a
   comment pointing at [issue #43](https://github.com/openai/codex-action/issues/43) (some repos
   require it).
5. **Dependency injection over HTTP mocking.** `ensureActorHasWriteAccess` takes an optional
   `octokit`, so `test/checkActorPermissions.test.mjs` needs no network and no mocking library. Only
   two units are tested at all: permission checking and CLI arg construction — the risky pure logic.
6. **A gap in our own spec**: it exposes `final-message` and `output-file`. We had decided every input
   and no outputs, and no ticket covered it.

## What we deliberately did not take

- **Actor gating.** `check-write-access` runs before the API key is used, with `allow-users`,
  `allow-bots`, `allow-bot-users`, treating only `github-actions[bot]` as inherently trusted, and
  refusing `*` for bot users. Its purpose is API-key abuse prevention for workflows triggered by
  outsiders. We trigger on plain `pull_request`, so fork and Dependabot PRs get no `ZAI_API_KEY` at
  all — the trigger is already the gate. An empty key becomes a clean skip, not a failure.
- **Sandboxing / `safety-strategy` / proxying the API key.** No code execution; nothing to sandbox.
- **"Run the action as the last step in a job."** Their recommendation exists because Codex may leave
  processes running or overwrite other actions' source on the host. Not a hazard for us.
- **Composite-action shape.** Their bash-step layering exists to sequence install/proxy/sudo-drop
  around the Node entrypoint. We have one entrypoint.

## Incidental confirmations

- `codex exec --output-schema` is real server/CLI-enforced structured output. z.ai has no equivalent
  (established separately), which is exactly why our parse-ladder + per-finding validation is not
  over-engineering.
- z.ai's coding plans do still list `glm-4.7` alongside `glm-5.2`/`glm-5-turbo`, so the map's open
  question about the default model id is about the pay-per-token API's served ids, not about `4.7`
  having vanished.
