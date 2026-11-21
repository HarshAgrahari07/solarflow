import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, test } from 'node:test'
import { createApp } from '../src/app.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import {
  createCustomer,
  createFollowUp,
  listCustomers,
} from '../src/services/customerService.js'
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
      category: 'Home',
      solarRequirement: 'On-Grid System',
      capacityKw: 4.5,
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
  const cookie = await getCookie('new.customer@example.test', registrationPassword)
  const profileResponse = await fetch(`${baseUrl}/api/customers/me`, {
    headers: { Cookie: cookie },
  })
  const profile = (await profileResponse.json()).customer
  assert.equal(profileResponse.status, 200)
  assert.equal(profile.category, 'Home')
  assert.equal(profile.solarRequirement, 'On-Grid System')
  assert.equal(profile.capacityKw, 4.5)
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
      category: 'Home',
      solarRequirement: 'On-Grid System',
      capacityKw: null,
      role: 'ADMIN',
    }),
  })
  assert.equal(response.status, 400)
  assert.equal(
    database.prepare('SELECT id FROM users WHERE email = ?').get('attempted.admin@example.test'),
    undefined,
  )
})

  test('customer registration and CRM reject invalid category and out-of-range capacity', async () => {
    const invalidPublicResponse = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Invalid Capacity',
        email: 'invalid.capacity@example.test',
        password: randomBytes(18).toString('base64url'),
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'On-Grid System',
        capacityKw: 5.1,
      }),
    })
    assert.equal(invalidPublicResponse.status, 400)

    const adminCookie = await getCookie('admin@sunpower.demo')
    const invalidLeadResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        fullName: 'Invalid Category',
        email: 'invalid.category@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Commercial',
        solarRequirement: 'On-Grid System',
        capacityKw: 1,
      }),
    })
    assert.equal(invalidLeadResponse.status, 400)
  })

  test('customer registration links an existing CRM lead without discarding its sales workflow', async () => {
    const adminCookie = await getCookie('admin@sunpower.demo')
    const salesId = database.prepare('SELECT id FROM users WHERE email = ?')
      .get('sales@sunpower.demo').id
    const leadResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        fullName: 'Lead Before Registration',
        email: 'convert.lead@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'On-Grid System',
        capacityKw: 3,
        assignedTo: salesId,
        leadStatus: 'Qualified',
        notes: 'Survey requested',
      }),
    })
    const lead = (await leadResponse.json()).customer
    const registrationPassword = randomBytes(18).toString('base64url')
    const registrationResponse = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Registered Lead',
        email: 'convert.lead@example.test',
        password: registrationPassword,
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'Off-Grid System',
        capacityKw: 4,
      }),
    })

    assert.equal(leadResponse.status, 201)
    assert.equal(registrationResponse.status, 201)
    const row = database.prepare(`
      SELECT linked_user_id, assigned_to, lead_status, notes, solar_requirement, capacity_kw
      FROM customers WHERE id = ?
    `).get(lead.id)
    assert.ok(row.linked_user_id)
    assert.equal(row.assigned_to, salesId)
    assert.equal(row.lead_status, 'Qualified')
    assert.equal(row.notes, 'Survey requested')
    assert.equal(row.solar_requirement, 'Off-Grid System')
    assert.equal(row.capacity_kw, 4)
    const archiveResponse = await fetch(`${baseUrl}/api/customers/${lead.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(archiveResponse.status, 409)
  })

  test('staff can create, search, update, and archive persisted customer leads', async () => {
    const adminCookie = await getCookie('admin@sunpower.demo')
    const salesId = database.prepare('SELECT id FROM users WHERE email = ?')
      .get('sales@sunpower.demo').id
    const createResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        fullName: 'CRM Lead',
        email: 'crm.lead@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Small Factory',
        solarRequirement: 'Off-Grid System',
        capacityKw: 5,
        assignedTo: salesId,
        notes: 'Interested in a site survey',
      }),
    })
    const created = (await createResponse.json()).customer

    assert.equal(createResponse.status, 201)
    assert.equal(created.category, 'Small Factory')
    assert.equal(created.solarRequirement, 'Off-Grid System')
    assert.equal(created.capacityKw, 5)
    assert.equal(created.assignedTo, salesId)

    const salesCookie = await getCookie('sales@sunpower.demo')
    const searchResponse = await fetch(`${baseUrl}/api/customers?search=CRM%20Lead`, {
      headers: { Cookie: salesCookie },
    })
    assert.equal(searchResponse.status, 200)
    assert.deepEqual((await searchResponse.json()).customers.map((customer) => customer.id), [created.id])

    const updateResponse = await fetch(`${baseUrl}/api/customers/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookie },
      body: JSON.stringify({ leadStatus: 'Qualified', notes: 'Survey requested' }),
    })
    assert.equal(updateResponse.status, 200)
    assert.equal((await updateResponse.json()).customer.leadStatus, 'Qualified')

    const archiveResponse = await fetch(`${baseUrl}/api/customers/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(archiveResponse.status, 204)
    const archivedResponse = await fetch(`${baseUrl}/api/customers?search=CRM%20Lead`, {
      headers: { Cookie: adminCookie },
    })
    assert.deepEqual((await archivedResponse.json()).customers, [])
  })

  test('sales assignment is restricted and customers can only read or edit their own profile', async () => {
    const anotherSalesEmail = 'another.sales@example.test'
    await insertTestUser({ email: anotherSalesEmail, role: 'SALES' })
    const anotherSalesId = database.prepare('SELECT id FROM users WHERE email = ?')
      .get(anotherSalesEmail).id
    const salesCookie = await getCookie('sales@sunpower.demo')
    const assignmentResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookie },
      body: JSON.stringify({
        fullName: 'Wrongly Assigned Lead',
        email: 'wrongly.assigned@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'On-Grid System',
        capacityKw: null,
        assignedTo: anotherSalesId,
      }),
    })
    assert.equal(assignmentResponse.status, 403)

    const adminCookie = await getCookie('admin@sunpower.demo')
    const createResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        fullName: 'Private Customer Record',
        email: 'private.customer@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'On-Grid System',
        capacityKw: 3,
        assignedTo: null,
      }),
    })
    const customerId = (await createResponse.json()).customer.id
    const customerCookie = await getCookie('customer@sunpower.demo')
    const ownResponse = await fetch(`${baseUrl}/api/customers/me`, {
      headers: { Cookie: customerCookie },
    })
    const ownCustomer = (await ownResponse.json()).customer
    const otherResponse = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      headers: { Cookie: customerCookie },
    })
    const forbiddenList = await fetch(`${baseUrl}/api/customers`, {
      headers: { Cookie: customerCookie },
    })
    const updateResponse = await fetch(`${baseUrl}/api/customers/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
      body: JSON.stringify({ phone: '+91 99999 12345' }),
    })

    assert.equal(ownResponse.status, 200)
    assert.equal(ownCustomer.email, 'customer@sunpower.demo')
    assert.equal('notes' in ownCustomer, false)
    assert.equal('leadStatus' in ownCustomer, false)
    assert.equal(otherResponse.status, 404)
    assert.equal(forbiddenList.status, 403)
    assert.equal(updateResponse.status, 200)
    assert.equal((await updateResponse.json()).customer.phone, '+91 99999 12345')
    assert.equal(
      database.prepare('SELECT phone FROM users WHERE email = ?').get('customer@sunpower.demo').phone,
      '+91 99999 12345',
    )
  })

  test('CRM APIs deny access to staff roles without customer permissions', async () => {
    for (const [role, email] of ROLE_EMAILS.filter(([role]) => !['ADMIN', 'SALES'].includes(role))) {
      const cookie = await getCookie(email)
      const response = await fetch(`${baseUrl}/api/customers`, {
        headers: { Cookie: cookie },
      })
      assert.equal(response.status, 403, `${role} must not list CRM records`)
    }
  })

  test('Sales can claim an unassigned lead through an update without submitting an owner field', async () => {
    const adminCookie = await getCookie('admin@sunpower.demo')
    const leadResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        fullName: 'Unassigned Lead',
        email: 'unassigned.lead@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'On-Grid System',
      }),
    })
    const lead = (await leadResponse.json()).customer
    const salesCookie = await getCookie('sales@sunpower.demo')
    const response = await fetch(`${baseUrl}/api/customers/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookie },
      body: JSON.stringify({ leadStatus: 'Contacted' }),
    })
    assert.equal(response.status, 200)
    const updatedLead = (await response.json()).customer
    assert.equal(updatedLead.leadStatus, 'Contacted')
    assert.equal(updatedLead.assignedTo, database.prepare('SELECT id FROM users WHERE email = ?')
      .get('sales@sunpower.demo').id)
  })

  test('staff follow-ups can be scheduled, completed and are reflected in customer records', async () => {
    const adminCookie = await getCookie('admin@sunpower.demo')
    const salesId = database.prepare('SELECT id FROM users WHERE email = ?')
      .get('sales@sunpower.demo').id
    const customerResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        fullName: 'Follow-up Lead',
        email: 'follow.up@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'Solar Panel Set',
        capacityKw: 2,
        assignedTo: salesId,
      }),
    })
    const customerId = (await customerResponse.json()).customer.id
    const salesCookie = await getCookie('sales@sunpower.demo')
    const followUpResponse = await fetch(`${baseUrl}/api/customers/${customerId}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookie },
      body: JSON.stringify({
        dueAt: new Date(Date.now() + 60_000).toISOString(),
        note: 'Call to confirm site survey date',
      }),
    })
    const followUp = (await followUpResponse.json()).followUp
    assert.equal(followUpResponse.status, 201)
    assert.equal(followUp.completed, false)
    const salesCustomerResponse = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      headers: { Cookie: salesCookie },
    })
    assert.equal((await salesCustomerResponse.json()).customer.nextFollowUpAt, followUp.dueAt)

    await insertTestUser({ email: 'second.sales@example.test', role: 'SALES' })
    const secondSalesId = database.prepare('SELECT id FROM users WHERE email = ?')
      .get('second.sales@example.test').id
    const adminFollowUp = await fetch(`${baseUrl}/api/customers/${customerId}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        dueAt: new Date(Date.now() + 120_000).toISOString(),
        note: 'Private follow-up for another salesperson',
        assignedTo: secondSalesId,
      }),
    })
    assert.equal(adminFollowUp.status, 201)

    const completeResponse = await fetch(
      `${baseUrl}/api/customers/${customerId}/follow-ups/${followUp.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: salesCookie },
        body: JSON.stringify({ completed: true }),
      },
    )
    assert.equal(completeResponse.status, 200)
    assert.equal((await completeResponse.json()).followUp.completed, true)

    const getResponse = await fetch(`${baseUrl}/api/customers/${customerId}/follow-ups`, {
      headers: { Cookie: salesCookie },
    })
    const visibleFollowUps = (await getResponse.json()).followUps
    assert.equal(visibleFollowUps.length, 1)
    assert.equal(visibleFollowUps[0].completed, true)
    assert.equal(visibleFollowUps[0].id, followUp.id)
    const customerAfterCompletion = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      headers: { Cookie: salesCookie },
    })
    assert.equal((await customerAfterCompletion.json()).customer.nextFollowUpAt, null)
    const secondSalesCookie = await getCookie('second.sales@example.test')
    const otherSalesCustomer = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      headers: { Cookie: secondSalesCookie },
    })
    assert.equal(otherSalesCustomer.status, 404)
  })

  test('customer CRM rows survive closing and reopening the SQLite database', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solarflow-crm-'))
    const filePath = path.join(directory, 'customers.sqlite')
    let persistentDatabase = openDatabase(filePath)
    try {
      initializeDatabase(persistentDatabase)
      const adminId = randomUUID()
      persistentDatabase.prepare(`
        INSERT INTO users (id, full_name, email, password_hash, role)
        VALUES (?, 'CRM Admin', 'crm-admin@example.test', 'unused-test-hash', 'ADMIN')
      `).run(adminId)
      const customer = createCustomer(persistentDatabase, {
        fullName: 'Persistent Lead',
        email: 'persistent.lead@example.test',
        phone: '+91 98765 43210',
        address: '12 Solar Street, Ludhiana',
        category: 'Home',
        solarRequirement: 'On-Grid System',
        capacityKw: 3,
        leadStatus: 'New',
        notes: '',
      }, { id: adminId, role: 'ADMIN' })
      createFollowUp(persistentDatabase, customer.id, {
        dueAt: new Date(Date.now() + 60_000).toISOString(),
        note: 'Persist a follow-up',
      }, { id: adminId, role: 'ADMIN' })
      persistentDatabase.close()

      persistentDatabase = openDatabase(filePath)
      initializeDatabase(persistentDatabase)
      const rows = listCustomers(persistentDatabase, { id: randomUUID(), role: 'ADMIN' })
      assert.equal(rows[0].id, customer.id)
      assert.equal(rows[0].fullName, 'Persistent Lead')
      assert.equal(persistentDatabase.prepare('SELECT COUNT(*) AS count FROM customer_follow_ups').get().count, 1)
    } finally {
      if (persistentDatabase.open) persistentDatabase.close()
      fs.rmSync(directory, { recursive: true, force: true })
    }
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
