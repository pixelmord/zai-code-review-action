import * as github from '@actions/github'

import type { ReviewGateway, ReviewRequest } from './contracts.js'

export function createGitHubReviewGateway(token: string): ReviewGateway {
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  function pullNumber(): number {
    const number = github.context.issue.number
    if (!Number.isInteger(number)) {
      throw new Error('z.ai Code Review runs only on pull_request events.')
    }
    return number
  }

  return {
    async getPullRequest() {
      const pullRequest = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber(),
        mediaType: { format: 'diff' },
      })
      const diff = typeof pullRequest.data === 'string' ? pullRequest.data : ''
      const metadata = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber() })

      return {
        title: metadata.data.title,
        body: metadata.data.body ?? '',
        diff,
      }
    },
    async createReview(review: ReviewRequest) {
      const created = await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber(),
        ...review,
        comments: [...review.comments],
      })
      return { url: created.data.html_url }
    },
  }
}
