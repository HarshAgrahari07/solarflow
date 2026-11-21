import { toPublicUser } from '../database/users.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { AUTH_COOKIE_NAME, cookieOptions } from '../middleware/authenticate.js'
import { createAuthService } from '../services/authService.js'

export function createAuthController({ database, config }) {
  const authService = createAuthService({ database, config })

  return {
    login: asyncHandler(async (request, response) => {
      const { user, token } = await authService.login(request.validatedBody)
      response.cookie(AUTH_COOKIE_NAME, token, cookieOptions(config))
      response.json({ user: toPublicUser(user) })
    }),

    logout(request, response) {
      const { maxAge, ...clearOptions } = cookieOptions(config)
      response.clearCookie(AUTH_COOKIE_NAME, clearOptions)
      response.status(204).end()
    },

    me(request, response) {
      response.json({ user: request.user })
    },

    registerCustomer: asyncHandler(async (request, response) => {
      const user = await authService.registerCustomer(request.validatedBody)
      response.status(201).json({ user: toPublicUser(user) })
    }),
  }
}
