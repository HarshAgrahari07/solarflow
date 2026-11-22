import path from 'node:path'
import { loadConfig } from '../src/config/env.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import { seedDemoUsers } from '../src/services/demoSeedService.js'

const config = loadConfig({ requireJwtSecret: false })
const database = openDatabase(config.databasePath)

try {
  initializeDatabase(database)
  const result = await seedDemoUsers(
    database,
    path.join(config.dataDir, 'demo-credentials.txt'),
  )
  console.log(`Seeded ${result.count} demo accounts. Credentials file: ${result.credentialsPath}`)
} finally {
  database.close()
}
