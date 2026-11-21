import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

const DEMO_USERS = [
  { fullName: 'Demo Administrator', email: 'admin@sunpower.demo', role: 'ADMIN' },
  { fullName: 'Demo Sales User', email: 'sales@sunpower.demo', role: 'SALES' },
  { fullName: 'Demo Surveyor', email: 'surveyor@sunpower.demo', role: 'SURVEYOR' },
  { fullName: 'Demo Warehouse User', email: 'warehouse@sunpower.demo', role: 'WAREHOUSE' },
  { fullName: 'Demo Technician', email: 'technician@sunpower.demo', role: 'TECHNICIAN' },
  { fullName: 'Demo Support User', email: 'support@sunpower.demo', role: 'SUPPORT' },
  { fullName: 'Demo Finance User', email: 'finance@sunpower.demo', role: 'FINANCE' },
  { fullName: 'Demo Customer', email: 'customer@sunpower.demo', role: 'CUSTOMER' },
]

function getOrCreateDemoPassword(credentialsPath) {
  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true })

  if (fs.existsSync(credentialsPath)) {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    if (typeof credentials.password !== 'string' || credentials.password.length < 24) {
      throw new Error(`Invalid local demo credentials file: ${credentialsPath}`)
    }
    return credentials.password
  }

  const password = randomBytes(24).toString('base64url')
  const credentials = {
    generatedAt: new Date().toISOString(),
    password,
    accounts: DEMO_USERS.map(({ email, role }) => ({ email, role })),
  }
  fs.writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  return password
}

export async function seedDemoUsers(database, credentialsPath) {
  const password = getOrCreateDemoPassword(credentialsPath)
  const users = await Promise.all(DEMO_USERS.map(async (user) => ({
    ...user,
    id: randomUUID(),
    passwordHash: await bcrypt.hash(password, 12),
  })))

  const insertOrUpdate = database.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role, is_active)
    VALUES (@id, @fullName, @email, @passwordHash, @role, 1)
    ON CONFLICT(email) DO UPDATE SET
      full_name = excluded.full_name,
      password_hash = excluded.password_hash,
      role = excluded.role,
      is_active = 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `)
  const insertUsers = database.transaction((records) => {
    for (const user of records) {
      insertOrUpdate.run(user)
    }
  })

  insertUsers(users)
  return { count: users.length, credentialsPath }
}
