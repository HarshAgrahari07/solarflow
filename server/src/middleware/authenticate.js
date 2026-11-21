import jwt from 'jsonwebtoken'
import { findUserById, toPublicUser } from '../database/users.js'
import { HttpError } from '../errors.js'

export const AUTH_COOKIE_NAME = 'sunpower_session'

export function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: 8 * 60 * 60 * 1000,
  }
}

function clearAuthCookie(response, config) {
  const { maxAge, ...options } = cookieOptions(config)
  response.clearCookie(AUTH_COOKIE_NAME, options)
}

export function authenticate({ database, config }) {
  return function authenticateRequest(request, response, next) {
    const token = request.cookies?.[AUTH_COOKIE_NAME]
    if (!token) {
      return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'))
    }

    let payload
    try {
      payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'sunpower-api',
        audience: 'sunpower-web',
      })
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        clearAuthCookie(response, config)
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'))
      }
      return next(error)
    }

    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      clearAuthCookie(response, config)
      return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'))
    }

    const user = findUserById(database, payload.sub)
    if (!user || !user.is_active) {
      clearAuthCookie(response, config)
      return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'))
    }

    request.user = toPublicUser(user)
    return next()
  }
}

export function authorizeRoles(...allowedRoles) {
  return function authorizeRequest(request, response, next) {
    if (!request.user) {
      return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'))
    }

    if (!allowedRoles.includes(request.user.role)) {
      return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to access this resource'))
    }

    return next()
  }
}
