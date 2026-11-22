import { loadConfig } from '../src/config/env.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import { seedDemoBusiness } from '../src/services/businessDemoSeedService.js'

const config = loadConfig({ requireJwtSecret: false })
const database = openDatabase(config.databasePath)

try {
  const migrations = initializeDatabase(database)
  const result = seedDemoBusiness(database)
  console.log(`Applied ${migrations.length} schema migrations.`)
  console.log(`Seeded ${result.customerCount} synthetic demo customers and leads.`)
  console.log(`Registered ${result.recordCount} synthetic demo records in batch ${result.batchId}.`)
  console.log('Existing user accounts were not modified by the business seed.')
} finally {
  database.close()
}
