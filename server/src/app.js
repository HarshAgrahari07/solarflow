import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { loadConfig } from './config/env.js'
import { openDatabase } from './database/connection.js'
import { initializeDatabase } from './database/schema.js'
import { corsForOrigin } from './middleware/cors.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { createAdminRouter } from './routes/admin.js'
import { createAuthRouter } from './routes/auth.js'
import { createHealthRouter } from './routes/health.js'

export function createApp({ database, config } = {}) {
  const resolvedConfig = config ?? loadConfig()
  const resolvedDatabase = database ?? openDatabase(resolvedConfig.databasePath)
  initializeDatabase(resolvedDatabase)

  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(corsForOrigin(resolvedConfig.frontendOrigin))
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  app.use('/api/health', createHealthRouter(resolvedDatabase))
  app.use('/api/auth', createAuthRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api/admin', createAdminRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use(notFoundHandler)
  app.use(errorHandler)

  app.locals.database = resolvedDatabase
  app.locals.config = resolvedConfig
  return app
}
