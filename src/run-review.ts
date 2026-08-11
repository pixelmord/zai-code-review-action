import type { ReviewGateway, ReviewModel } from './contracts.js'

export type RunOutcome =
  | 'reviewed'
  | 'skipped-no-api-key'
  | 'skipped-no-reviewable-files'
  | 'unavailable'
  | 'failed'

export interface ReviewRunConfig {
  readonly zaiApiKey: string
}

export interface ReviewRunDependencies {
  readonly gateway: ReviewGateway
  readonly model: ReviewModel
}

export interface ReviewRunResult {
  readonly outcome: RunOutcome
  readonly reviewUrl: string
}

export async function runReview(
  config: ReviewRunConfig,
  _dependencies: ReviewRunDependencies,
): Promise<ReviewRunResult> {
  if (config.zaiApiKey.trim() === '') {
    return { outcome: 'skipped-no-api-key', reviewUrl: '' }
  }

  return { outcome: 'failed', reviewUrl: '' }
}
