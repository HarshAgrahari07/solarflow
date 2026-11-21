import { Router } from 'express'
import { createCustomerController } from '../controllers/customerController.js'
import { authenticate, authorizePermission, authorizeRoles } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import {
  customerCreateSchema,
  customerSelfUpdateSchema,
  customerUpdateSchema,
  followUpCreateSchema,
  followUpUpdateSchema,
} from '../validation/authSchemas.js'

export function createCustomerRouter({ database, config }) {
  const router = Router()
  const controller = createCustomerController({ database })
  const requireUser = authenticate({ database, config })

  router.get(
    '/me',
    requireUser,
    authorizeRoles('CUSTOMER'),
    controller.getOwnProfile,
  )
  router.patch(
    '/me',
    requireUser,
    authorizePermission('customer:profile:update'),
    authorizeRoles('CUSTOMER'),
    validateBody(customerSelfUpdateSchema),
    controller.updateOwnProfile,
  )

  router.get(
    '/',
    requireUser,
    authorizePermission('customers:read'),
    controller.list,
  )
  router.post(
    '/',
    requireUser,
    authorizePermission('customers:create'),
    validateBody(customerCreateSchema),
    controller.create,
  )

  router.get(
    '/:customerId/follow-ups',
    requireUser,
    authorizePermission('customers:followups'),
    controller.listFollowUps,
  )
  router.post(
    '/:customerId/follow-ups',
    requireUser,
    authorizePermission('customers:followups'),
    validateBody(followUpCreateSchema),
    controller.createFollowUp,
  )
  router.patch(
    '/:customerId/follow-ups/:followUpId',
    requireUser,
    authorizePermission('customers:followups'),
    validateBody(followUpUpdateSchema),
    controller.updateFollowUp,
  )

  router.get('/:customerId', requireUser, controller.get)
  router.patch(
    '/:customerId',
    requireUser,
    authorizePermission('customers:update'),
    validateBody(customerUpdateSchema),
    controller.update,
  )
  router.delete(
    '/:customerId',
    requireUser,
    authorizePermission('customers:archive'),
    controller.archive,
  )

  return router
}
