import { Router } from 'express'
import { createAdminController } from '../controllers/adminController.js'
import { authenticate, authorizeRoles } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import { staffRegistrationSchema } from '../validation/authSchemas.js'

export function createAdminRouter({ database, config }) {
  const router = Router()
  const controller = createAdminController({ database })

  router.post(
    '/users',
    authenticate({ database, config }),
    authorizeRoles('ADMIN'),
    validateBody(staffRegistrationSchema),
    controller.createStaffUser,
  )

  return router
}
