import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiRequest } from '../src/auth/api.js'

test('binary survey uploads preserve the image body and cookie credentials', async () => {
  const originalFetch = globalThis.fetch
  const image = new Blob(['image bytes'], { type: 'image/png' })
  let captured

  globalThis.fetch = async (path, options) => {
    captured = { path, options }
    return new Response(JSON.stringify({ photo: { id: 'photo-1' } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await apiRequest('/api/surveys/survey-1/photos', {
      method: 'POST',
      body: image,
      headers: { 'X-File-Name': 'roof.png' },
    })
    assert.deepEqual(response, { photo: { id: 'photo-1' } })
    assert.equal(captured.path, '/api/surveys/survey-1/photos')
    assert.equal(captured.options.method, 'POST')
    assert.equal(captured.options.credentials, 'include')
    assert.equal(captured.options.headers['Content-Type'], 'image/png')
    assert.equal(captured.options.headers['X-File-Name'], 'roof.png')
    assert.equal(captured.options.body, image)
  } finally {
    globalThis.fetch = originalFetch
  }
})
