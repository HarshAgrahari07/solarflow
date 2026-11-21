import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  archiveCustomer,
  createCustomer,
  createFollowUp,
  getCustomerForActor,
  getCustomerForUser,
  listCustomers,
  listFollowUps,
  listSalesUsers,
  updateCustomer,
  updateFollowUp,
} from '../services/customerService.js'
import { customerListQuerySchema } from '../validation/authSchemas.js'

export function createCustomerController({ database }) {
  return {
    list: asyncHandler((request, response, next) => {
      const parsed = customerListQuerySchema.safeParse(request.query)
      if (!parsed.success) return next(parsed.error)
      const { search, leadStatus, includeArchived } = parsed.data
      response.json({
        customers: listCustomers(database, request.user, {
          search,
          leadStatus,
          includeArchived: includeArchived === 'true',
        }),
        salesUsers: listSalesUsers(database),
      })
    }),

    create: asyncHandler((request, response) => {
      const customer = createCustomer(database, request.validatedBody, request.user)
      response.status(201).json({ customer })
    }),

    get: asyncHandler((request, response) => {
      const customer = getCustomerForActor(database, request.params.customerId, request.user)
      response.json({ customer })
    }),

    getOwnProfile: asyncHandler((request, response) => {
      const customer = getCustomerForUser(database, request.user.id)
      response.json({ customer })
    }),

    update: asyncHandler((request, response) => {
      const customer = updateCustomer(
        database,
        request.params.customerId,
        request.validatedBody,
        request.user,
      )
      response.json({ customer })
    }),

    updateOwnProfile: asyncHandler((request, response) => {
      const customer = getCustomerForUser(database, request.user.id)
      const updatedCustomer = updateCustomer(
        database,
        customer.id,
        request.validatedBody,
        request.user,
      )
      response.json({ customer: updatedCustomer })
    }),

    archive: asyncHandler((request, response) => {
      archiveCustomer(database, request.params.customerId)
      response.status(204).end()
    }),

    listFollowUps: asyncHandler((request, response) => {
      const followUps = listFollowUps(database, request.params.customerId, request.user)
      response.json({ followUps })
    }),

    createFollowUp: asyncHandler((request, response) => {
      const followUp = createFollowUp(
        database,
        request.params.customerId,
        request.validatedBody,
        request.user,
      )
      response.status(201).json({ followUp })
    }),

    updateFollowUp: asyncHandler((request, response) => {
      const followUp = updateFollowUp(
        database,
        request.params.customerId,
        request.params.followUpId,
        request.validatedBody,
        request.user,
      )
      response.json({ followUp })
    }),
  }
}
