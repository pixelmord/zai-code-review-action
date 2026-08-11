import { describe, expect, it } from 'vitest'

import { runReview } from '../src/run-review.js'
import type { ReviewGateway, ReviewModel } from '../src/contracts.js'

describe('runReview', () => {
  it('skips cleanly before contacting either port when the z.ai key is absent', async () => {
    const calls: string[] = []
    const gateway: ReviewGateway = {
      async getPullRequestContext() {
        calls.push('gateway.getPullRequestContext')
        throw new Error('should not be called')
      },
    }
    const model: ReviewModel = {
      async complete() {
        calls.push('model.complete')
        throw new Error('should not be called')
      },
    }

    const result = await runReview({ zaiApiKey: '' }, { gateway, model })

    expect(result).toEqual({ outcome: 'skipped-no-api-key', reviewUrl: '' })
    expect(calls).toEqual([])
  })
})
