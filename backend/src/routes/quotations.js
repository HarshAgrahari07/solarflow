import { Router } from 'express'
import { createQuotationController } from '../controllers/quotationController.js'
import { authenticate, authorizePermission, authorizeRoles } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import {
  quotationCreateSchema,
  quotationItemsSchema,
  quotationResponseSchema,
  quotationStatusSchema,
  packageTemplateUpdateSchema,
} from '../validation/quotationSchemas.js'

export function createQuotationRouter({ database, config }) {
  const router = Router()
  const controller = createQuotationController({ database })
  const requireUser = authenticate({ database, config })
  const authorizeSalesOrAdmin = authorizeRoles('ADMIN', 'SALES')
  const authorizeQuotationRead = (request, response, next) => (
    authorizePermission(request.user.role === 'CUSTOMER' ? 'quotations:self' : 'quotations:manage')(
      request,
      response,
      next,
    )
  )

  router.get(
    '/options',
    requireUser,
    authorizePermission('quotations:manage'),
    authorizeSalesOrAdmin,
    controller.options,
  )
  router.put(
    '/templates/:templateId',
    requireUser,
    authorizePermission('quotations:manage'),
    authorizeRoles('ADMIN'),
    validateBody(packageTemplateUpdateSchema),
    controller.updateTemplate,
  )
  router.get(
    '/',
    requireUser,
    authorizeRoles('ADMIN', 'SALES', 'CUSTOMER'),
    authorizeQuotationRead,
    controller.list,
  )
  router.post(
    '/',
    requireUser,
    authorizePermission('quotations:manage'),
    authorizeSalesOrAdmin,
    validateBody(quotationCreateSchema),
    controller.create,
  )
  router.get(
    '/:quoteId',
    requireUser,
    authorizeRoles('ADMIN', 'SALES', 'CUSTOMER'),
    controller.get,
  )
  router.put(
    '/:quoteId/items',
    requireUser,
    authorizePermission('quotations:manage'),
    authorizeSalesOrAdmin,
    validateBody(quotationItemsSchema),
    controller.updateItems,
  )
  router.patch(
    '/:quoteId/status',
    requireUser,
    authorizePermission('quotations:manage'),
    authorizeSalesOrAdmin,
    validateBody(quotationStatusSchema),
    controller.updateStatus,
  )
  router.post(
    '/:quoteId/respond',
    requireUser,
    authorizeRoles('CUSTOMER'),
    validateBody(quotationResponseSchema),
    controller.respond,
  )
  return router
}
