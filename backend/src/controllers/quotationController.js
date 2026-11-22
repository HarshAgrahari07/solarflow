import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  createQuotation,
  getQuotation,
  getQuotationOptions,
  listQuotations,
  respondToQuotation,
  updatePackageTemplate,
  updateQuotationItems,
  updateQuotationStatus,
} from '../services/quotationService.js'

export function createQuotationController({ database }) {
  return {
    options: asyncHandler((request, response) => {
      response.json(getQuotationOptions(database, request.user))
    }),

    list: asyncHandler((request, response) => {
      response.json({ quotations: listQuotations(database, request.user) })
    }),

    get: asyncHandler((request, response) => {
      response.json({ quotation: getQuotation(database, request.params.quoteId, request.user) })
    }),

    create: asyncHandler((request, response) => {
      const quotation = createQuotation(database, request.validatedBody, request.user)
      response.status(201).json({ quotation })
    }),

    updateStatus: asyncHandler((request, response) => {
      const quotation = updateQuotationStatus(
        database,
        request.params.quoteId,
        request.validatedBody.status,
        request.user,
      )
      response.json({ quotation })
    }),

    updateItems: asyncHandler((request, response) => {
      const quotation = updateQuotationItems(
        database,
        request.params.quoteId,
        request.validatedBody,
        request.user,
      )
      response.json({ quotation })
    }),

    respond: asyncHandler((request, response) => {
      const quotation = respondToQuotation(
        database,
        request.params.quoteId,
        request.validatedBody,
        request.user,
      )
      response.json({ quotation })
    }),

    updateTemplate: asyncHandler((request, response) => {
      const items = updatePackageTemplate(
        database,
        request.params.templateId,
        request.validatedBody,
        request.user,
      )
      response.json({ items })
    }),
  }
}
