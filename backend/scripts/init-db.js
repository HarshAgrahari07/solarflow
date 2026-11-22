import { loadConfig } from '../src/config/env.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'

const config = loadConfig({ requireJwtSecret: false })
const database = openDatabase(config.databasePath)

try {
  initializeDatabase(database)
  console.log(`Database initialized at ${config.databasePath}`)
} finally {
  database.close()
}
