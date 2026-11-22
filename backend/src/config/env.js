import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

export const BACKEND_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  JWT_SECRET: z.string().min(32).optional(),
  DATA_DIR: z.string().min(1).optional(),
  DATABASE_PATH: z.string().min(1).optional(),
  FILE_STORAGE_PATH: z.string().min(1).optional(),
  FRONTEND_ORIGIN: z.string().url().optional(),
})

function isWithinDirectory(directory, target) {
  const relative = path.relative(directory, target)
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
}

export function loadConfig({ requireJwtSecret = true } = {}) {
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true })

  const parsed = environmentSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.message}`)
  }

  const values = parsed.data
  if ((requireJwtSecret || values.NODE_ENV === 'production') && !values.JWT_SECRET) {
    throw new Error(values.NODE_ENV === 'production'
      ? 'JWT_SECRET is required in production; configure a cryptographically random secret.'
      : 'JWT_SECRET is required. Run "npm run setup" to create local configuration.')
  }

  const dataDir = path.resolve(
    BACKEND_ROOT,
    values.DATA_DIR || (values.NODE_ENV === 'production' ? '/app/data' : 'data'),
  )
  const databasePath = values.DATABASE_PATH
    ? (values.DATABASE_PATH === ':memory:'
      ? ':memory:'
      : path.resolve(BACKEND_ROOT, values.DATABASE_PATH))
    : path.join(dataDir, 'sunpower.sqlite')
  const fileStoragePath = values.FILE_STORAGE_PATH
    ? path.resolve(BACKEND_ROOT, values.FILE_STORAGE_PATH)
    : path.join(dataDir, 'uploads')

  if (values.NODE_ENV === 'production') {
    if (databasePath === ':memory:' || !isWithinDirectory(dataDir, databasePath)) {
      throw new Error('Production DATABASE_PATH must be inside DATA_DIR.')
    }
    if (!isWithinDirectory(dataDir, fileStoragePath)) {
      throw new Error('Production FILE_STORAGE_PATH must be inside DATA_DIR.')
    }
  }

  const frontendOrigin = values.FRONTEND_ORIGIN
    ? new URL(values.FRONTEND_ORIGIN).origin
    : values.NODE_ENV === 'production' ? null : 'http://localhost:5173'
  if (values.NODE_ENV === 'production' && frontendOrigin && new URL(frontendOrigin).protocol !== 'https:') {
    throw new Error('Production FRONTEND_ORIGIN must use HTTPS.')
  }

  return {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    jwtSecret: values.JWT_SECRET,
    dataDir,
    databasePath,
    fileStoragePath,
    frontendOrigin,
  }
}
