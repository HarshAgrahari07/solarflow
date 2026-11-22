import express, { Router } from 'express'
import { createSurveyController } from '../controllers/surveyController.js'
import { authenticate, authorizePermission, authorizeRoles } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import {
  surveyCreateSchema,
  surveyListQuerySchema,
  surveyReviewSchema,
  surveyScheduleUpdateSchema,
  surveySubmitSchema,
  surveyUpdateSchema,
  surveyVisitStatusSchema,
} from '../validation/surveySchemas.js'

export function createSurveyRouter({ database, config }) {
  const router = Router()
  const controller = createSurveyController({ database, config })
  const requireUser = authenticate({ database, config })
  const rawPhoto = express.raw({ type: '*/*', limit: '5mb' })

  router.get(
    '/surveyors',
    requireUser,
    authorizePermission('surveys:schedule'),
    controller.listSurveyors,
  )
  router.get(
    '/',
    requireUser,
    authorizePermission('surveys:read'),
    controller.list,
  )
  router.post(
    '/',
    requireUser,
    authorizePermission('surveys:schedule'),
    authorizeRoles('ADMIN', 'SALES'),
    validateBody(surveyCreateSchema),
    controller.create,
  )
  router.get(
    '/:surveyId/photos/:photoId',
    requireUser,
    authorizePermission('surveys:read'),
    controller.getPhoto,
  )
  router.post(
    '/:surveyId/photos',
    requireUser,
    authorizePermission('survey:submit'),
    rawPhoto,
    controller.uploadPhoto,
  )
  router.patch(
    '/:surveyId/schedule',
    requireUser,
    authorizePermission('surveys:schedule'),
    authorizeRoles('ADMIN', 'SALES'),
    validateBody(surveyScheduleUpdateSchema),
    controller.updateSchedule,
  )
  router.patch(
    '/:surveyId/status',
    requireUser,
    authorizePermission('survey:submit'),
    validateBody(surveyVisitStatusSchema),
    controller.updateVisitStatus,
  )
  router.patch(
    '/:surveyId',
    requireUser,
    authorizePermission('survey:submit'),
    validateBody(surveyUpdateSchema),
    controller.updateDraft,
  )
  router.post(
    '/:surveyId/submit',
    requireUser,
    authorizePermission('survey:submit'),
    validateBody(surveySubmitSchema),
    controller.submit,
  )
  router.post(
    '/:surveyId/review',
    requireUser,
    authorizePermission('survey:approve'),
    authorizeRoles('ADMIN'),
    validateBody(surveyReviewSchema),
    controller.review,
  )
  router.get(
    '/:surveyId',
    requireUser,
    authorizePermission('surveys:read'),
    controller.get,
  )

  return router
}
