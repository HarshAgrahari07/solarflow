import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, test } from 'node:test'
import { createApp } from '../src/app.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import {
  AUTH_COOKIE_NAME,
  authenticate,
  authorizePermission,
  authorizeRoles,
} from '../src/middleware/authenticate.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

let database
let server
let protectedServer
let baseUrl
let protectedBaseUrl
let password
let config

const ROLE_EMAILS = [
  ['ADMIN', 'admin@sunpower.demo'],
  ['SALES', 'sales@sunpower.demo'],
  ['SURVEYOR', 'surveyor@sunpower.demo'],
  ['WAREHOUSE', 'warehouse@sunpower.demo'],
  ['TECHNICIAN', 'technician@sunpower.demo'],
  ['SUPPORT', 'support@sunpower.demo'],
  ['FINANCE', 'finance@sunpower.demo'],
  ['CUSTOMER', 'customer@sunpower.demo'],
]

async function insertTestUser({ email, role }) {
  const passwordHash = await bcrypt.hash(password, 4)
  database.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), `Test ${role}`, email, passwordHash, role)
}

async function getCookie(email, loginPassword = password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: loginPassword }),
  })
  return response.headers.get('set-cookie')?.split(';', 1)[0]
}

beforeEach(async () => {
  password = randomBytes(18).toString('base64url')
  config = {
    nodeEnv: 'test',
    port: 0,
    jwtSecret: randomBytes(48).toString('base64url'),
    databasePath: ':memory:',
    frontendOrigin: 'http://localhost:5173',
  }
  database = openDatabase(':memory:')
  initializeDatabase(database)
  for (const [role, email] of ROLE_EMAILS) {
    await insertTestUser({ email, role })
  }

  const app = createApp({ database, config })
  const protectedApp = express()
  protectedApp.use(cookieParser())
  protectedApp.get(
    '/admin',
    authenticate({ database, config }),
    authorizeRoles('ADMIN'),
    (request, response) => response.json({ role: request.user.role }),
  )
  protectedApp.get(
    '/finance',
    authenticate({ database, config }),
    authorizePermission('finance:admin'),
    (request, response) => response.json({ role: request.user.role }),
  )
  protectedApp.get(
    '/warehouse',
    authenticate({ database, config }),
    authorizePermission('warehouse:admin'),
    (request, response) => response.json({ role: request.user.role }),
  )
  protectedApp.post(
    '/survey-approval',
    authenticate({ database, config }),
    authorizePermission('survey:approve'),
    (request, response) => response.json({ role: request.user.role }),
  )
  protectedApp.get(
    '/staff-admin',
    authenticate({ database, config }),
    authorizePermission('staff:create'),
    (request, response) => response.json({ role: request.user.role }),
  )
  protectedApp.use(errorHandler)

  server = createServer(app)
  protectedServer = createServer(protectedApp)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
  await new Promise((resolve, reject) => {
    protectedServer.once('error', reject)
    protectedServer.listen(0, '127.0.0.1', resolve)
  })
  protectedBaseUrl = `http://127.0.0.1:${protectedServer.address().port}`
})

afterEach(async () => {
  for (const activeServer of [server, protectedServer]) {
    if (!activeServer?.listening) continue
    await new Promise((resolve, reject) => {
      activeServer.close((error) => error ? reject(error) : resolve())
    })
  }
  database?.close()
})

test('health endpoint returns an OK status', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('login returns a safe user and HttpOnly cookie', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ADMIN@sunpower.demo', password }),
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.user.role, 'ADMIN')
  assert.equal('password_hash' in body.user, false)
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i)
})

test('all eight role accounts can log in and restore their user from /me', async () => {
  for (const [role, email] of ROLE_EMAILS) {
    const cookie = await getCookie(email)
    assert.match(cookie, /^sunpower_session=/)
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).user.role, role)
  }
})

test('customers receive only their own authenticated profile from /me', async () => {
  const cookie = await getCookie('customer@sunpower.demo')
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.user.email, 'customer@sunpower.demo')
  assert.equal(body.user.role, 'CUSTOMER')
  assert.equal('customers' in body, false)
  assert.equal('password_hash' in body.user, false)
})

test('invalid password receives a generic credentials error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sunpower.demo', password: 'wrong-password' }),
  })

  assert.equal(response.status, 401)
  assert.deepEqual((await response.json()).error, {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  })
})

test('inactive users cannot sign in or continue an existing session', async () => {
  const cookie = await getCookie('admin@sunpower.demo')
  const admin = database.prepare('SELECT id FROM users WHERE email = ?')
    .get('admin@sunpower.demo')
  database.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(admin.id)

  const sessionResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  })
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sunpower.demo', password }),
  })

  assert.equal(sessionResponse.status, 401)
  assert.equal(loginResponse.status, 401)
})

test('expired sessions are rejected', async () => {
  const adminId = database.prepare('SELECT id FROM users WHERE email = ?')
    .get('admin@sunpower.demo').id
  const expiredToken = jwt.sign(
    { sub: adminId },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: -1,
      issuer: 'sunpower-api',
      audience: 'sunpower-web',
    },
  )
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${expiredToken}` },
  })

  assert.equal(response.status, 401)
})

test('logout clears the authentication cookie', async () => {
  const cookie = await getCookie('admin@sunpower.demo')
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  })

  assert.equal(response.status, 204)
  assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i)
})

test('customer registration creates a CUSTOMER account with profile fields', async () => {
  const registrationPassword = randomBytes(18).toString('base64url')
  const response = await fetch(`${baseUrl}/api/auth/register-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'New Customer',
      email: 'new.customer@example.test',
      password: registrationPassword,
      phone: '+91 98765 43210',
      address: '12 Solar Street, Ludhiana',
    }),
  })
  const body = await response.json()
  const storedUser = database.prepare('SELECT * FROM users WHERE email = ?')
    .get('new.customer@example.test')

  assert.equal(response.status, 201)
  assert.equal(body.user.role, 'CUSTOMER')
  assert.equal(body.user.phone, '+91 98765 43210')
  assert.equal(body.user.address, '12 Solar Street, Ludhiana')
  assert.equal('password_hash' in body.user, false)
  assert.notEqual(storedUser.password_hash, registrationPassword)
  assert.equal(await bcrypt.compare(registrationPassword, storedUser.password_hash), true)
})

test('public registration rejects supplied staff or administrator roles', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Attempted Admin',
      email: 'attempted.admin@example.test',
      password: randomBytes(18).toString('base64url'),
      phone: '+91 98765 43210',
      address: '12 Solar Street, Ludhiana',
      role: 'ADMIN',
    }),
  })

  assert.equal(response.status, 400)
  assert.equal(
    database.prepare('SELECT id FROM users WHERE email = ?').get('attempted.admin@example.test'),
    undefined,
  )
})

test('only administrators can create supported staff accounts', async () => {
  const adminCookie = await getCookie('admin@sunpower.demo')
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      fullName: 'New Technician',
      email: 'new.technician@example.test',
      password: randomBytes(18).toString('base64url'),
      role: 'TECHNICIAN',
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.user.role, 'TECHNICIAN')
  assert.equal('password_hash' in body.user, false)
})

test('only administrators can create staff and administrators cannot create administrators', async () => {
  for (const [role, email] of ROLE_EMAILS.filter(([role]) => role !== 'ADMIN')) {
    const cookie = await getCookie(email)
    const response = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        fullName: `Attempted ${role}`,
        email: `attempted.${role.toLowerCase()}@example.test`,
        password: randomBytes(18).toString('base64url'),
        role: 'SALES',
      }),
    })
    assert.equal(response.status, 403, `${role} must not create staff accounts`)
  }

  const adminCookie = await getCookie('admin@sunpower.demo')
  const adminPromotionResponse = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      fullName: 'Attempted Administrator',
      email: 'attempted.admin@example.test',
      password: randomBytes(18).toString('base64url'),
      role: 'ADMIN',
    }),
  })
  assert.equal(adminPromotionResponse.status, 400)
  assert.equal(
    database.prepare('SELECT id FROM users WHERE email = ?').get('attempted.admin@example.test'),
    undefined,
  )
})

test('unauthenticated requests are denied protected access', async () => {
  const response = await fetch(`${protectedBaseUrl}/admin`)
  assert.equal(response.status, 401)
})

test('backend permissions deny role access to finance, warehouse, survey approval, and admin scopes', async () => {
  const deniedCases = [
    ['sales@sunpower.demo', '/finance'],
    ['technician@sunpower.demo', '/warehouse'],
    ['surveyor@sunpower.demo', '/survey-approval'],
    ['support@sunpower.demo', '/staff-admin'],
    ['customer@sunpower.demo', '/staff-admin'],
  ]

  for (const [email, path] of deniedCases) {
    const cookie = await getCookie(email)
    const response = await fetch(`${protectedBaseUrl}${path}`, {
      method: path === '/survey-approval' ? 'POST' : 'GET',
      headers: { Cookie: cookie },
    })
    assert.equal(response.status, 403, `${email} must not access ${path}`)
  }

  const financeCookie = await getCookie('finance@sunpower.demo')
  const financeResponse = await fetch(`${protectedBaseUrl}/finance`, {
    headers: { Cookie: financeCookie },
  })
  assert.equal(financeResponse.status, 200)
})

test('authorization reads the user role from SQLite instead of JWT claims', async () => {
  const salesId = database.prepare('SELECT id FROM users WHERE email = ?')
    .get('sales@sunpower.demo').id
  const forgedRoleToken = jwt.sign(
    { sub: salesId, role: 'ADMIN' },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: 'sunpower-api',
      audience: 'sunpower-web',
    },
  )
  const response = await fetch(`${protectedBaseUrl}/admin`, {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${forgedRoleToken}` },
  })

  assert.equal(response.status, 403)
})
