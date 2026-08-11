export interface PullRequestContext {
  readonly owner: string
  readonly repository: string
  readonly pullNumber: number
}

export interface ReviewGateway {
  getPullRequestContext(): Promise<PullRequestContext>
}

export interface ReviewModel {
  complete(prompt: string): Promise<string>
}
