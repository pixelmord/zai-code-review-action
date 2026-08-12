import { afterEach, describe, expect, it, vi } from 'vitest'

import { createZaiReviewModel } from '../src/zai-review-model.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createZaiReviewModel', () => {
  it('uses GLM-5.2 high reasoning and the action-owned JSON controls', async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"findings":[]}' } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetch)

    const content = await createZaiReviewModel('secret').complete({
      model: 'glm-5.2',
      prompt: 'Review this diff.',
    })

    expect(content).toBe('{"findings":[]}')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.z.ai/api/paas/v4/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'glm-5.2',
          messages: [{ role: 'user', content: 'Review this diff.' }],
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
          temperature: 0.2,
          max_tokens: 8000,
          response_format: { type: 'json_object' },
        }),
      }),
    )
  })
})
