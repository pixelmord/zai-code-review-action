import type { ModelRequest, ReviewModel } from './contracts.js'

const endpoint = 'https://api.z.ai/api/paas/v4/chat/completions'

export function createZaiReviewModel(apiKey: string): ReviewModel {
  return {
    async complete(request: ModelRequest) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: 'user', content: request.prompt }],
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
          temperature: 0.2,
          max_tokens: 8000,
          response_format: { type: 'json_object' },
        }),
      })
      if (!response.ok) {
        throw new Error(`z.ai request failed with HTTP ${response.status}.`)
      }

      const payload: unknown = await response.json()
      const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        throw new Error('z.ai response did not include completion content.')
      }
      return content
    },
  }
}
