import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { createAuthController } from '../controllers/authController.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import { customerRegistrationSchema, loginSchema } from '../validation/authSchemas.js'

export function createAuthRouter({ database, config }) {
  const router = Router()
  const controller = createAuthController({ database, config })

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler(request, response) {
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
        },
      })
    },
  })

  router.post('/login', loginLimiter, validateBody(loginSchema), controller.login)
  router.post('/logout', controller.logout)
  router.get('/me', authenticate({ database, config }), controller.me)
  router.post('/register-customer', validateBody(customerRegistrationSchema), controller.registerCustomer)

  return router
}
