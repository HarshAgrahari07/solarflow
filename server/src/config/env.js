import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

export const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  JWT_SECRET: z.string().min(32).optional(),
  DATABASE_PATH: z.string().min(1).default('data/sunpower.sqlite'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
})

export function loadConfig({ requireJwtSecret = true } = {}) {
  dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true })

  const parsed = environmentSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.message}`)
  }

  const values = parsed.data
  if (requireJwtSecret && !values.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Run "npm run setup" to create local configuration.')
  }
  if (
    values.NODE_ENV === 'production'
    && (!process.env.FRONTEND_ORIGIN || new URL(values.FRONTEND_ORIGIN).protocol !== 'https:')
  ) {
    throw new Error('Production requires FRONTEND_ORIGIN to be an explicit HTTPS URL.')
  }

  return {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    jwtSecret: values.JWT_SECRET,
    databasePath: path.isAbsolute(values.DATABASE_PATH)
      ? values.DATABASE_PATH
      : path.resolve(SERVER_ROOT, values.DATABASE_PATH),
    frontendOrigin: values.FRONTEND_ORIGIN,
  }
}
