import * as core from '@actions/core'

import type { ReviewGateway, ReviewModel } from './contracts.js'
import { runReview } from './run-review.js'

const unavailableGateway: ReviewGateway = {
  async getPullRequestContext() {
    throw new Error('The GitHub review gateway is not available yet.')
  },
}

const unavailableModel: ReviewModel = {
  async complete() {
    throw new Error('The z.ai review model is not available yet.')
  },
}

async function run(): Promise<void> {
  const zaiApiKey = core.getInput('zai-api-key')

  if (zaiApiKey !== '') {
    core.setSecret(zaiApiKey)
  }

  const result = await runReview(
    { zaiApiKey },
    { gateway: unavailableGateway, model: unavailableModel },
  )

  core.setOutput('outcome', result.outcome)
  core.setOutput('review-url', result.reviewUrl)

  if (result.outcome === 'skipped-no-api-key') {
    core.notice('z.ai review skipped: API key unavailable')
    return
  }

  core.setFailed('The z.ai review pipeline is not available yet.')
}

void run()
