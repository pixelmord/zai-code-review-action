export interface PullRequest {
  readonly title: string
  readonly body: string
  readonly diff: string
}

export interface ReviewComment {
  readonly body: string
  readonly path: string
  readonly line: number
  readonly side: 'RIGHT'
}

export interface ReviewRequest {
  readonly body: string
  readonly event: 'COMMENT'
  readonly comments: readonly ReviewComment[]
}

export interface ReviewGateway {
  getPullRequest(): Promise<PullRequest>
  createReview(review: ReviewRequest): Promise<{ readonly url: string }>
}

export interface ModelRequest {
  readonly model: string
  readonly prompt: string
}

export interface ReviewModel {
  complete(request: ModelRequest): Promise<string>
}
