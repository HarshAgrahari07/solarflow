import { Router } from 'express'
import { createAdminController } from '../controllers/adminController.js'
import { authenticate, authorizePermission } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import { staffRegistrationSchema } from '../validation/authSchemas.js'

export function createAdminRouter({ database, config }) {
  const router = Router()
  const controller = createAdminController({ database })

  router.post(
    '/users',
    authenticate({ database, config }),
    authorizePermission('staff:create'),
    validateBody(staffRegistrationSchema),
    controller.createStaffUser,
  )

  return router
}
