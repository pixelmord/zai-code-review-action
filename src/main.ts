import * as core from '@actions/core'
import * as github from '@actions/github'

import { createGitHubReviewGateway } from './github-review-gateway.js'
import { runReview } from './run-review.js'
import { createZaiReviewModel } from './zai-review-model.js'

function maxDiffChars(): number {
  const value = Number.parseInt(core.getInput('max-diff-chars'), 10)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('max-diff-chars must be a positive integer.')
  }
  return value
}

async function run(): Promise<void> {
  const zaiApiKey = core.getInput('zai-api-key')

  if (zaiApiKey === '') {
    core.setOutput('outcome', 'skipped-no-api-key')
    core.setOutput('review-url', '')
    core.notice('z.ai review skipped: API key unavailable')
    return
  }

  core.setSecret(zaiApiKey)

  try {
    const result = await runReview(
      { zaiApiKey, model: core.getInput('model'), maxDiffChars: maxDiffChars() },
      {
        gateway: createGitHubReviewGateway(process.env.GITHUB_TOKEN ?? ''),
        model: createZaiReviewModel(zaiApiKey),
      },
    )

    core.setOutput('outcome', result.outcome)
    core.setOutput('review-url', result.reviewUrl)

  } catch (error) {
    core.setOutput('outcome', 'failed')
    core.setOutput('review-url', '')
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

if (github.context.eventName === 'pull_request') {
  void run()
} else {
  core.setOutput('outcome', 'failed')
  core.setOutput('review-url', '')
  core.setFailed('z.ai Code Review runs only on pull_request events.')
}
