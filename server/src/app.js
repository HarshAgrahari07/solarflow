import fs from 'node:fs'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import path from 'node:path'
import { loadConfig, SERVER_ROOT } from './config/env.js'
import { openDatabase } from './database/connection.js'
import { initializeDatabase } from './database/schema.js'
import { corsForOrigin } from './middleware/cors.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { createAdminRouter } from './routes/admin.js'
import { createAuthRouter } from './routes/auth.js'
import { createCustomerRouter } from './routes/customers.js'
import { createHealthRouter } from './routes/health.js'
import { createSurveyRouter } from './routes/surveys.js'
import { createQuotationRouter } from './routes/quotations.js'
import { createWorkflowRouter } from './routes/workflows.js'

export function createApp({ database, config } = {}) {
  const resolvedConfig = config ?? loadConfig()
  if (resolvedConfig.dataDir) {
    fs.mkdirSync(resolvedConfig.dataDir, { recursive: true, mode: 0o700 })
  }
  if (resolvedConfig.fileStoragePath) {
    fs.mkdirSync(resolvedConfig.fileStoragePath, { recursive: true, mode: 0o700 })
  }
  if (resolvedConfig.nodeEnv === 'production' && process.platform !== 'win32') {
    fs.chmodSync(resolvedConfig.dataDir, 0o700)
    fs.chmodSync(resolvedConfig.fileStoragePath, 0o700)
  }
  const resolvedDatabase = database ?? openDatabase(resolvedConfig.databasePath)
  initializeDatabase(resolvedDatabase)

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', resolvedConfig.nodeEnv === 'production' ? 1 : false)
  app.use(helmet())
  app.use(corsForOrigin(resolvedConfig.frontendOrigin))
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  app.use('/api/health', createHealthRouter(resolvedDatabase))
  app.use('/api/auth', createAuthRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api/customers', createCustomerRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api/surveys', createSurveyRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api/quotations', createQuotationRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api/operations', createWorkflowRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api/admin', createAdminRouter({ database: resolvedDatabase, config: resolvedConfig }))
  app.use('/api', notFoundHandler)

  if (resolvedConfig.nodeEnv === 'production') {
    const clientDist = resolvedConfig.clientDistPath
      ? path.resolve(resolvedConfig.clientDistPath)
      : path.resolve(SERVER_ROOT, '..', 'client', 'dist')
    const indexPath = path.join(clientDist, 'index.html')
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Production frontend build not found at ${indexPath}. Build client/dist before startup.`)
    }
    app.use(express.static(clientDist, { index: false, dotfiles: 'deny' }))
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) {
        return next()
      }
      return response.sendFile(indexPath, (error) => {
        if (error) next(error)
      })
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  app.locals.database = resolvedDatabase
  app.locals.config = resolvedConfig
  return app
}
