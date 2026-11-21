import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { loadConfig, SERVER_ROOT } from '../src/config/env.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import { seedDemoUsers } from '../src/services/demoSeedService.js'

const envPath = path.join(SERVER_ROOT, '.env')
if (!fs.existsSync(envPath)) {
  const envContents = [
    `JWT_SECRET=${randomBytes(48).toString('base64url')}`,
    'NODE_ENV=development',
    'PORT=4000',
    'FRONTEND_ORIGIN=http://localhost:5173',
    'DATABASE_PATH=data/sunpower.sqlite',
    '',
  ].join('\n')
  fs.writeFileSync(envPath, envContents, { flag: 'wx', mode: 0o600 })
}

const config = loadConfig()
const database = openDatabase(config.databasePath)
try {
  initializeDatabase(database)
  const result = await seedDemoUsers(
    database,
    path.join(SERVER_ROOT, 'data', 'demo-credentials.txt'),
  )
  console.log(`Local configuration and database are ready at ${config.databasePath}`)
  console.log(`Seeded ${result.count} demo accounts. Local credentials: ${result.credentialsPath}`)
} finally {
  database.close()
}
