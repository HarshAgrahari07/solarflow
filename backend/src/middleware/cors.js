import { HttpError } from '../errors.js'

export function corsForOrigin(allowedOrigin) {
  return function corsMiddleware(request, response, next) {
    const origin = request.get('Origin')
    const requestOrigin = `${request.protocol}://${request.get('host')}`
    const expectedOrigin = allowedOrigin || requestOrigin

    if (origin && origin !== expectedOrigin) {
      return next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed'))
    }

    if (origin) {
      response.vary('Origin')
      response.set('Access-Control-Allow-Origin', origin)
      response.set('Access-Control-Allow-Credentials', 'true')
    }

    if (request.method === 'OPTIONS') {
      response.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
      response.set('Access-Control-Allow-Headers', 'Content-Type')
      return response.sendStatus(204)
    }

    return next()
  }
}
