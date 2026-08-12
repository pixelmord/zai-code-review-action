import { describe, expect, it } from 'vitest'

import type { ReviewGateway, ReviewModel } from '../src/contracts.js'
import { runReview } from '../src/run-review.js'

describe('runReview', () => {
  it('skips cleanly before contacting either port when the z.ai key is absent', async () => {
    const calls: string[] = []
    const gateway: ReviewGateway = {
      async getPullRequest() {
        calls.push('gateway.getPullRequest')
        throw new Error('should not be called')
      },
      async createReview() {
        calls.push('gateway.createReview')
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

  it('bounds the patch content in its one standard review request', async () => {
    const gateway: ReviewGateway = {
      async getPullRequest() {
        return { title: 'T', body: '', diff: '0123456789' }
      },
      async createReview() {
        return { url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-1' }
      },
    }
    const model: ReviewModel = {
      async complete(request) {
        expect(request.prompt).toContain('0123')
        expect(request.prompt).not.toContain('456789')
        return '{"findings":[]}'
      },
    }

    await runReview({ zaiApiKey: 'secret', maxDiffChars: 4 }, { gateway, model })
  })

  it('posts one COMMENT review for valid findings from the model', async () => {
    const calls: string[] = []
    const gateway: ReviewGateway = {
      async getPullRequest() {
        calls.push('gateway.getPullRequest')
        return {
          title: 'Fix token parsing',
          body: 'Handle invalid tokens.',
          diff: 'diff --git a/src/token.ts b/src/token.ts\n+export function parse() {}\n',
        }
      },
      async createReview(review) {
        calls.push('gateway.createReview')
        expect(review).toEqual({
          body: 'z.ai review',
          event: 'COMMENT',
          comments: [
            {
              body: '**🟠 Major**\n\nValidate the token before using it.',
              path: 'src/token.ts',
              line: 1,
              side: 'RIGHT',
            },
          ],
        })
        return { url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-1' }
      },
    }
    const model: ReviewModel = {
      async complete(request) {
        calls.push('model.complete')
        expect(request.model).toBe('glm-5.2')
        expect(request.prompt).toContain('Fix token parsing')
        expect(request.prompt).toContain('diff --git')
        return JSON.stringify({
          findings: [
            {
              file: 'src/token.ts',
              line: 1,
              severity: 'major',
              message: 'Validate the token before using it.',
            },
          ],
        })
      },
    }

    await expect(runReview({ zaiApiKey: 'secret', model: 'glm-5.2', maxDiffChars: 100_000 }, { gateway, model })).resolves.toEqual({
      outcome: 'reviewed',
      reviewUrl: 'https://github.com/acme/widgets/pull/7#pullrequestreview-1',
    })
    expect(calls).toEqual(['gateway.getPullRequest', 'model.complete', 'gateway.createReview'])
  })
})
