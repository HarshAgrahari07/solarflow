import { asyncHandler } from './asyncHandler.js'

export function validateBody(schema) {
  return asyncHandler((request, response, next) => {
    const result = schema.safeParse(request.body)
    if (!result.success) {
      return next(result.error)
    }

    request.validatedBody = result.data
    return next()
  })
}
