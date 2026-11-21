import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { loadConfig } from '../src/config/env.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import { createUser } from '../src/services/userService.js'

function option(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

const email = option('--email')?.trim().toLowerCase()
const fullName = option('--full-name')?.trim() || 'SunPower Administrator'
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Usage: npm run admin:create -- --email admin@example.com [--full-name "Administrator Name"]')
}

const config = loadConfig()
const database = openDatabase(config.databasePath)

try {
  initializeDatabase(database)
  const credentialsPath = path.join(config.dataDir, 'initial-admin-credentials.txt')
  if (fs.existsSync(credentialsPath)) {
    throw new Error(`Administrator credentials already exist at ${credentialsPath}; retrieve and remove that file before provisioning another administrator.`)
  }
  const password = randomBytes(32).toString('base64url')
  const user = await createUser(database, {
    fullName,
    email,
    password,
    role: 'ADMIN',
  })
  try {
    fs.writeFileSync(credentialsPath, `email=${user.email}\npassword=${password}\n`, {
      flag: 'wx',
      mode: 0o600,
    })
  } catch (error) {
    database.prepare('DELETE FROM users WHERE id = ?').run(user.id)
    throw error
  }
  console.log(`Created administrator ${user.email}. Retrieve the generated credentials from ${credentialsPath} using an authorized shell.`)
} finally {
  database.close()
}
