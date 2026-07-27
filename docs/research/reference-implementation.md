# Research: tarmojussila/zai-code-review

Source: https://github.com/tarmojussila/zai-code-review (fetched via WebFetch on github.com blob/README and raw.githubusercontent.com for action.yml, package.json, src/index.js). Repo appears small/single-file; version at time of research: package.json `0.4.0`.

**Caveat on method**: WebFetch summarizes rather than dumping raw text (it runs content through a small model), even against raw.githubusercontent.com URLs. Where I asked for verbatim quotes I got them for short/distinctive strings (endpoint URL, marker, prompt templates), but I cannot 100% guarantee no paraphrasing occurred in the surrounding narrative, and I did not get true line-numbered full source. Treat direct quotes as sourced, treat prose descriptions as one-hop summaries.

## 1. Runtime type, action.yml
JS action (not composite/docker): `runs: using: "node20", main: "dist/index.js"`. Built with `@vercel/ncc` from `src/index.js` (`npm run build`).

Inputs (from action.yml):
- `ZAI_API_KEY` (required, secret)
- `ZAI_MODEL` (default `"glm-4.7"`)
- `ZAI_SYSTEM_PROMPT` (default: "You are an expert code reviewer. Review the provided code changes and give clear, actionable feedback.")
- `ZAI_REVIEWER_NAME` (default `"Z.ai Code Review"`, used as comment header)
- `EXCLUDE_PATTERNS` (default `"*.lock,package-lock.json,yarn.lock,pnpm-lock.yaml"`)
- `MAX_DIFF_CHARS` (default `"0"` = unlimited)
- `GITHUB_TOKEN` (default `${{ github.token }}`)

No declared `outputs:` block found.

## 2. z.ai API call
- Endpoint (quoted from source): `https://api.z.ai/api/coding/paas/v4/chat/completions`
- Auth: presumably Bearer token using `ZAI_API_KEY` in an Authorization header (not directly confirmed verbatim, but is the only credential input and endpoint is OpenAI-style chat completions).
- Model: single model name input, default `glm-4.7`, no fallback/multi-model logic seen.
- Request body: `{ model, messages: [{role:'system', content: systemPrompt}, {role:'user', content: prompt}] }` — no temperature/max_tokens params set.
- User prompt template (quoted): "Please review the following pull request changes and provide concise, constructive feedback. Focus on bugs, logic errors, security issues, and meaningful improvements. Skip trivial style comments.\n\n${diffs}"
- System prompt: fully driven by the `ZAI_SYSTEM_PROMPT` input (no hardcoded default template beyond the action.yml default string above) — this IS the existing prompt-customization mechanism.
- No enforced output format, no severity labels, no emoji scheme baked into the prompt — severity/formatting is left entirely to whatever the model produces given the system prompt. This is notably simpler than what we're planning (severity levels + suggested fixes).

## 3. Diff/file selection
- `getChangedFiles()` pulls PR file list via GitHub REST API (`@actions/github`/Octokit), paginated at 100 files/page.
- `matchesPattern()` implements custom glob-to-regex (`*` within a path segment, `**` across segments) used against `EXCLUDE_PATTERNS` to filter files.
- `buildPrompt()` concatenates per-file diffs into one big prompt string, tracking a running character count against `MAX_DIFF_CHARS`; files that would exceed the limit are dropped and listed as "excluded" rather than reviewed.
- **No chunking/splitting across multiple API calls** — everything goes in a single request; `MAX_DIFF_CHARS=0` (default) means no limit at all, i.e. no built-in safety net against huge diffs unless the repo owner sets a nonzero value.

## 4. Posting results
- Single summary comment only — no inline/per-line review comments, no GitHub Checks API usage mentioned.
- Uses GitHub Issues API comment methods (`createComment` for new, `updateComment` for existing) rather than the Pulls review API.
- Idempotency/update-in-place via a hidden marker: `const COMMENT_MARKER = '<!-- zai-code-review -->'` — existing comments are searched for this marker to decide create vs. update.
- Comment header uses `ZAI_REVIEWER_NAME` input.
- No severity/label scheme in the output structure itself (see above) — whatever severity markers appear would only exist because the model was told to via a custom system prompt.

## 5. Prompt customization
- Yes, but only one level: the entire **system prompt** is replaceable via the `ZAI_SYSTEM_PROMPT` input/repo variable. No support for repo-defined prompt *files* (e.g., a markdown file checked into the repo, or a "skill"-style directory) — customization is a single string input passed through the workflow YAML/repo variable, not read from the target repo's filesystem at review time.
- No distinction between a "standard built-in prompt" and "custom prompt" beyond the one default string in action.yml — there's no mode switch, just an overridable default.
- This is a clear gap relative to what we want to design: reading a markdown file or "skill" directory from the reviewed repo to build the prompt isn't present here at all.

## 6. Error handling / rate limiting / cost control
- Timeout protection on the HTTPS request: 300 seconds.
- Response size validation: 1MB limit.
- JSON parse verification and HTTP status checking on the z.ai response.
- Cost/size control is limited to `MAX_DIFF_CHARS` (opt-in, off by default) and static `EXCLUDE_PATTERNS` (lock files etc. by default). No token-counting, no retry/backoff logic, no rate-limit-specific handling reported, no per-file diff chunking, no streaming.

## 7. Dependencies
Runtime deps (from package.json):
- `@actions/core` ^1.10.1
- `@actions/github` ^6.0.0
Dev:
- `@vercel/ncc` ^0.38.1 (bundles `src/index.js` → `dist/index.js`)
No HTTP client library dependency listed — the z.ai call is likely made with Node's built-in `https` module (consistent with "communicates via HTTPS" description and absence of `axios`/`node-fetch` in deps).

Other repo files noted but not deeply inspected: `.github/workflows/`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` (MIT), `dist/` (built output), `package-lock.json`.

## Gaps / unclear
- Did not confirm the exact Authorization header format for the z.ai API key (Bearer scheme assumed, not verbatim-quoted).
- Did not verify whether GITHUB_TOKEN is used only for reading PR files/posting comments or also for anything else (e.g., checks).
- Could not obtain true line-numbered raw source dump due to WebFetch's summarization layer; if exact line-by-line code is needed later, fetch `dist/index.js` (bundled, more stable) or clone the repo directly instead of relying on WebFetch.
- No `outputs:` were found in action.yml — could not verify there are truly none vs. WebFetch omitting them; worth a direct look if outputs matter to the new design.
