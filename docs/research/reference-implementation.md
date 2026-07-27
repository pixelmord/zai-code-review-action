# Research: tarmojussila/zai-code-review

Source: https://github.com/tarmojussila/zai-code-review at commit `d7e9d64` (2026-04-16, "Merge pull request #22 from tarmojussila/feature/exclude-patterns-max-diffs"), package.json version `0.4.0`.

**Method:** repo cloned and read directly. `src/index.js` is a single 211-line file; all claims below are verified against source, not summarized. (An earlier pass of this doc was WebFetch-based and carried a paraphrase caveat — that caveat is resolved and its four open questions are answered inline below.)

## 1. Runtime type, action.yml
JS action (not composite/docker): `runs: using: "node20", main: "dist/index.js"`. Built with `@vercel/ncc` from `src/index.js` (`npm run build` → `ncc build src/index.js -o dist --license licenses.txt`).

Inputs (all SCREAMING_CASE):
- `ZAI_API_KEY` (required)
- `ZAI_MODEL` (default `"glm-4.7"`)
- `ZAI_SYSTEM_PROMPT` (default: "You are an expert code reviewer. Review the provided code changes and give clear, actionable feedback.")
- `ZAI_REVIEWER_NAME` (default `"Z.ai Code Review"`, used as comment header)
- `EXCLUDE_PATTERNS` (default `"*.lock,package-lock.json,yarn.lock,pnpm-lock.yaml"`)
- `MAX_DIFF_CHARS` (default `"0"` = unlimited)
- `GITHUB_TOKEN` (default `${{ github.token }}`)

**Confirmed: no `outputs:` block.** Findings are not exposed to downstream workflow steps at all.

Also present (missed by the first pass): a `branding:` block (`icon: check-circle`, `color: gray-dark`) — i.e. the reference repo *is* set up for Marketplace listing, which we deliberately ruled out.

Required workflow permission is just `pull-requests: write` (per README/SECURITY.md).

## 2. z.ai API call
- Endpoint: `https://api.z.ai/api/coding/paas/v4/chat/completions` (`src/index.js:5`)
- **Auth confirmed:** `'Authorization': \`Bearer ${apiKey}\`` (`:94`). Plain Bearer, no custom scheme.
- Model: single input, default `glm-4.7`, no fallback/multi-model logic.
- Request body (`:73–85`): `{ model, messages: [{role:'system', content: systemPrompt}, {role:'user', content: prompt}] }`. **No `temperature`, no `max_tokens`, no `response_format`, no streaming.** Relevant to us: for JSON-constrained output we'd likely want an explicit low temperature, which this offers no precedent for.
- Response extraction (`:116`): `parsed.choices?.[0]?.message?.content` — standard OpenAI-shaped envelope.
- User prompt template (`:68`, verbatim): `Please review the following pull request changes and provide concise, constructive feedback. Focus on bugs, logic errors, security issues, and meaningful improvements. Skip trivial style comments.\n\n${diffs}`
- System prompt is entirely the `ZAI_SYSTEM_PROMPT` input — this IS the whole prompt-customization mechanism.
- No enforced output format, no severity taxonomy, no emoji scheme. Formatting is whatever the model emits.
- Raw Node `https` module, no HTTP client dep (`:3`).

## 3. Diff/file selection
- `getChangedFiles()` (`:28`) — `octokit.rest.pulls.listFiles`, correctly paginated at 100/page.
- `matchesPattern()` (`:10`) — hand-rolled glob→regex: escapes regex metachars, `**`→`.*`, `*`→`[^/]*` via a `\x00` sentinel. Tests **both the full path and the basename** (`:18`), so `*.lock` matches nested lockfiles too.
- `buildPrompt()` (`:46`) — filters to `f.patch` truthy, then packs per-file `### file (status)` + fenced diff entries while cumulative chars stay under `MAX_DIFF_CHARS`. Over-limit files are skipped, not chunked.
- **No chunking across API calls.** `MAX_DIFF_CHARS=0` (the default) means genuinely unlimited — no safety net unless the consumer sets it.

**Important behavior the first pass missed** (`:47`): GitHub's `listFiles` omits `patch` for binary files *and* for diffs it considers too large. So oversized files are silently dropped by the API *before* `MAX_DIFF_CHARS` is ever consulted — the real large-file cutoff is GitHub's, not the action's. Directly relevant to our exclude-patterns and large-diff tickets.

## 4. Posting results
- Single summary comment via the **Issues** API, not the Pulls review API — `issues.createComment` / `issues.updateComment` (`:185–208`).
- Body shape (`:183`): `## ${reviewerName}\n\n${review}\n\n<!-- zai-code-review -->`
- Idempotency via hidden marker `COMMENT_MARKER = '<!-- zai-code-review -->'` (`:6`); prior comment found by `.includes()` and updated in place.
- No inline/per-line comments, no Checks API, no severity scheme in the output structure.

**Two latent bugs here worth not inheriting** (`:185–190`):
1. `issues.listComments` is called **unpaginated** (defaults to 30 per page). On a PR with more than ~30 comments the marker isn't found, so the action posts a *duplicate* comment instead of updating.
2. `comments.find(c => c.body.includes(...))` — `body` is optional on the GitHub comment schema; a bodyless comment throws a `TypeError`.

Our reconciliation step has the same "find my own prior artifact" shape, so both apply to it.

## 5. Prompt customization
- One level only: the whole system prompt is replaceable via the `ZAI_SYSTEM_PROMPT` input (README suggests wiring it to `vars.ZAI_SYSTEM_PROMPT`).
- **No** repo-committed prompt file, no skill directory, no filesystem read from the reviewed repo. No standard-vs-custom mode switch — just an overridable default string.
- This is the clearest gap vs. our design (`.github/zai-review-prompt.md` file convention): there is no prior art here to borrow.

## 6. Error handling / rate limiting / cost control
- Request timeout 300s (`REQUEST_TIMEOUT_MS = 300_000`, `:8`, `:129`).
- Response size cap 1MB (`MAX_RESPONSE_SIZE`, `:7`), enforced streaming-wise on `data` (`:103`).
- HTTP status check + JSON parse guard + empty-content guard (`:108–124`); error bodies truncated to 200 chars.
- Top-level `run().catch(err => core.setFailed(err.message))` (`:211`) — any failure fails the step. Note: this means the reference *does* fail the workflow on API/infra errors, though never on review findings.
- Early exits: not a PR event → `setFailed` (`:155`); nothing patchable after filtering → clean skip (`:174`).
- **No retry, no backoff, no rate-limit handling, no token counting.**

**Good practice to copy** (`:139`, `:149`): `core.setSecret()` is called on both the API key *and* the GitHub token, masking them in logs.

**Weakness to avoid** (`:147`): `parseInt(core.getInput('MAX_DIFF_CHARS'), 10) || 0` — a typo'd or non-numeric value silently becomes `0`, i.e. *unlimited*. The cost control fails **open**. Ours should fail closed.

**Divergence to note** (`:64–66`): the skipped-files notice is appended **into the prompt** ("> **Note:** The following files were excluded…"), not into the PR comment. The model is told, and may or may not relay it to the human. Our decision to surface skips directly in the PR output is a deliberate improvement, not a port.

## 7. Dependencies
Runtime: `@actions/core` ^1.10.1, `@actions/github` ^6.0.0 — that's all.
Dev: `@vercel/ncc` ^0.38.1.
Confirmed: z.ai calls use Node's built-in `https` (`:3`); no axios/node-fetch.

## 8. Security posture (from SECURITY.md / README)
- API key must be an Actions secret, scoped to only the workflows needing it.
- Minimum permission `pull-requests: write`, explicitly "do not grant broader."
- Recommends pinning to a release tag (`@v0.4.0`), not `@main`.
- **Not addressed anywhere in the reference:** fork PRs. A `pull_request`-triggered workflow on a fork PR receives no repository secrets, so `ZAI_API_KEY` is empty and `core.getInput(..., {required: true})` fails the step. Same for Dependabot PRs. The reference simply doesn't handle this case; our spec needs a stated position on it.

## Remaining unknowns
- Whether the z.ai API supports a schema-constrained response mode (`response_format`/tool-calling). The reference doesn't use one, so it's no evidence either way — needs checking against z.ai's own docs if we ever want to harden our JSON contract beyond prompt instruction.
- Real-world reliability of `glm-4.7` at emitting strict JSON — untested here, since the reference never asks for structured output.
