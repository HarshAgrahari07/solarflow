import { toPublicUser } from '../database/users.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createUser } from '../services/userService.js'

export function createAdminController({ database }) {
  return {
    createStaffUser: asyncHandler(async (request, response) => {
      const user = await createUser(database, request.validatedBody)
      response.status(201).json({ user: toPublicUser(user) })
    }),
  }
}
