export class ApiError extends Error {
  constructor(message, status = 0, code = 'API_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob
  const isArrayBuffer = body instanceof ArrayBuffer
  const isBinaryBody = isBlob || isArrayBuffer
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : {
          'Content-Type': isBinaryBody
            ? (isBlob && body.type ? body.type : 'application/octet-stream')
            : 'application/json',
        }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: isBinaryBody ? body : JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError('Unable to connect to SunPower services. Check the server and try again.')
  }

  let payload = null
  if (response.status !== 204) {
    try {
      payload = await response.json()
    } catch {
      throw new ApiError('The server returned an invalid response.', response.status)
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || 'The request could not be completed.',
      response.status,
      payload?.error?.code,
    )
  }

  return payload
}

export async function fetchCurrentUser() {
  const response = await apiRequest('/api/auth/me')
  return response.user
}
