import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, test } from 'node:test'
import { createApp } from '../src/app.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'

let database
let server
let baseUrl
let password
let config
let tempDirectory
let userIds

function insertUser(role, email) {
  const id = randomUUID()
  const passwordHash = bcrypt.hashSync(password, 4)
  database.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, `Test ${role}`, email, passwordHash, role)
  return id
}

async function startServer() {
  server = createServer(createApp({ database, config }))
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
}

async function stopServer() {
  if (!server?.listening) return
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
  server = null
}

async function login(email, loginPassword = password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: loginPassword }),
  })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';', 1)[0]
}

async function createCustomer(adminCookie, { email, assignedTo = null } = {}) {
  const response = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      fullName: 'Survey Test Customer',
      email: email || `customer.${randomUUID()}@example.test`,
      phone: '+91 98765 43210',
      address: '12 Solar Street, Ludhiana',
      category: 'Home',
      solarRequirement: 'On-Grid System',
      capacityKw: 3,
      assignedTo,
    }),
  })
  assert.equal(response.status, 201)
  return (await response.json()).customer
}

async function scheduleSurvey(adminOrSalesCookie, customerId, assignedSurveyorId = userIds.surveyor) {
  const response = await fetch(`${baseUrl}/api/surveys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminOrSalesCookie },
    body: JSON.stringify({
      customerId,
      assignedSurveyorId,
      siteAddress: '12 Solar Street, Ludhiana',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  })
  return response
}

const completeFindings = {
  shadowFreeRoofAreaSqm: 42.5,
  monthlyElectricityBillInr: 7800,
  gridSuitability: 'SUITABLE',
  customerRequirements: 'Reduce daytime grid consumption',
  preliminaryObservations: 'Open access to the south roof section',
  roofDirection: 'S',
  roofTiltDegrees: 18,
  cableDistanceMeters: 12.4,
  actualAvailableRoofAreaSqm: 51.2,
  siteCondition: 'Concrete roof; access ladder available',
  shadeObservations: 'No significant shade during the site visit',
  technicalNotes: 'Synthetic test observations',
}

async function submitFindings(surveyId, surveyorCookie) {
  const update = await fetch(`${baseUrl}/api/surveys/${surveyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: surveyorCookie },
    body: JSON.stringify(completeFindings),
  })
  assert.equal(update.status, 200)
  const submit = await fetch(`${baseUrl}/api/surveys/${surveyId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: surveyorCookie },
    body: '{}',
  })
  assert.equal(submit.status, 200)
  return (await submit.json()).survey
}

beforeEach(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'solarflow-survey-test-'))
  password = randomBytes(18).toString('base64url')
  const databasePath = path.join(tempDirectory, 'survey-test.sqlite')
  config = {
    nodeEnv: 'test',
    jwtSecret: randomBytes(48).toString('base64url'),
    databasePath,
    fileStoragePath: path.join(tempDirectory, 'uploads'),
    frontendOrigin: 'http://localhost:5173',
  }
  database = openDatabase(databasePath)
  initializeDatabase(database)
  userIds = {
    admin: insertUser('ADMIN', 'admin@survey.test'),
    sales: insertUser('SALES', 'sales@survey.test'),
    otherSales: insertUser('SALES', 'sales.other@survey.test'),
    surveyor: insertUser('SURVEYOR', 'surveyor@survey.test'),
    otherSurveyor: insertUser('SURVEYOR', 'surveyor.other@survey.test'),
    other: insertUser('SUPPORT', 'support@survey.test'),
  }
  await startServer()
})

afterEach(async () => {
  await stopServer()
  if (database?.open) database.close()
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})

test('Admin schedules a survey linked to a valid customer and active surveyor', async () => {
  const adminCookie = await login('admin@survey.test')
  const customer = await createCustomer(adminCookie)
  const response = await scheduleSurvey(adminCookie, customer.id)
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.match(body.survey.reference, /^SRV-[A-F0-9]{8}$/)
  assert.equal(body.survey.customerId, customer.id)
  assert.equal(body.survey.assignedSurveyorId, userIds.surveyor)
  assert.equal(body.survey.siteAddress, '12 Solar Street, Ludhiana')
  assert.equal(body.survey.status, 'SCHEDULED')
  assert.ok(body.survey.scheduledAt)

  const invalid = await scheduleSurvey(adminCookie, randomUUID())
  assert.equal(invalid.status, 404)
})

test('Sales can schedule only surveys for customers in their permitted CRM scope', async () => {
  const adminCookie = await login('admin@survey.test')
  const salesCookie = await login('sales@survey.test')
  const permitted = await createCustomer(adminCookie, { assignedTo: userIds.sales })
  const other = await createCustomer(adminCookie, {
    email: 'other.owner@example.test',
    assignedTo: userIds.otherSales,
  })

  assert.equal((await scheduleSurvey(salesCookie, permitted.id)).status, 201)
  assert.equal((await scheduleSurvey(salesCookie, other.id)).status, 404)

  const surveyors = await fetch(`${baseUrl}/api/surveys/surveyors`, {
    headers: { Cookie: salesCookie },
  })
  assert.equal(surveyors.status, 200)
  assert.equal((await surveyors.json()).surveyors.length, 2)
})

test('Admin can reschedule a survey and its assigned Surveyor can start the visit', async () => {
  const adminCookie = await login('admin@survey.test')
  const surveyorCookie = await login('surveyor@survey.test')
  const customer = await createCustomer(adminCookie)
  const survey = (await (await scheduleSurvey(adminCookie, customer.id)).json()).survey
  const appointment = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const rescheduled = await fetch(`${baseUrl}/api/surveys/${survey.id}/schedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ scheduledAt: appointment, siteAddress: '18 Solar Avenue, Ludhiana' }),
  })
  assert.equal(rescheduled.status, 200)
  const updated = (await rescheduled.json()).survey
  assert.equal(updated.siteAddress, '18 Solar Avenue, Ludhiana')
  assert.equal(updated.scheduledAt, appointment)

  const started = await fetch(`${baseUrl}/api/surveys/${survey.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: surveyorCookie },
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  })
  assert.equal(started.status, 200)
  assert.equal((await started.json()).survey.visitStatus, 'IN_PROGRESS')
})

test('Surveyors see only assigned surveys and cannot open another assignment', async () => {
  const adminCookie = await login('admin@survey.test')
  const surveyorCookie = await login('surveyor@survey.test')
  const firstCustomer = await createCustomer(adminCookie)
  const secondCustomer = await createCustomer(adminCookie)
  const first = await scheduleSurvey(adminCookie, firstCustomer.id, userIds.surveyor)
  const second = await scheduleSurvey(adminCookie, secondCustomer.id, userIds.otherSurveyor)
  const firstSurvey = (await first.json()).survey
  const secondSurvey = (await second.json()).survey

  const list = await fetch(`${baseUrl}/api/surveys`, { headers: { Cookie: surveyorCookie } })
  assert.deepEqual((await list.json()).surveys.map((survey) => survey.id), [firstSurvey.id])
  const otherSurvey = await fetch(`${baseUrl}/api/surveys/${secondSurvey.id}`, {
    headers: { Cookie: surveyorCookie },
  })
  assert.equal(otherSurvey.status, 404)
  const unauthorizedRole = await fetch(`${baseUrl}/api/surveys`, {
    headers: { Cookie: await login('support@survey.test') },
  })
  assert.equal(unauthorizedRole.status, 403)
})

test('assigned Surveyor saves and submits findings; only Admin can approve and history is recorded', async () => {
  const adminCookie = await login('admin@survey.test')
  const surveyorCookie = await login('surveyor@survey.test')
  const customer = await createCustomer(adminCookie)
  const scheduled = await scheduleSurvey(adminCookie, customer.id)
  const survey = (await scheduled.json()).survey
  const submitted = await submitFindings(survey.id, surveyorCookie)
  assert.equal(submitted.status, 'PENDING_APPROVAL')
  assert.equal(submitted.shadowFreeRoofAreaSqm, completeFindings.shadowFreeRoofAreaSqm)
  assert.equal(submitted.monthlyElectricityBillInr, completeFindings.monthlyElectricityBillInr)
  assert.equal(submitted.cableDistanceMeters, completeFindings.cableDistanceMeters)

  const surveyorApproval = await fetch(`${baseUrl}/api/surveys/${survey.id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: surveyorCookie },
    body: JSON.stringify({ action: 'APPROVE', comments: '' }),
  })
  assert.equal(surveyorApproval.status, 403)
  const unauthorized = await fetch(`${baseUrl}/api/surveys/${survey.id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: await login('support@survey.test') },
    body: JSON.stringify({ action: 'APPROVE' }),
  })
  assert.equal(unauthorized.status, 403)

  const approvedResponse = await fetch(`${baseUrl}/api/surveys/${survey.id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ action: 'APPROVE', comments: 'Measurements reviewed' }),
  })
  const approved = (await approvedResponse.json()).survey
  assert.equal(approvedResponse.status, 200)
  assert.equal(approved.status, 'APPROVED')
  assert.equal(approved.approvalHistory.length, 1)
  assert.equal(approved.approvalHistory[0].reviewerId, userIds.admin)
  assert.equal(approved.approvalHistory[0].decision, 'APPROVE')
  assert.equal(approved.approvalHistory[0].comments, 'Measurements reviewed')
})

test('Admin may request corrections with a reason and Surveyor may resubmit', async () => {
  const adminCookie = await login('admin@survey.test')
  const surveyorCookie = await login('surveyor@survey.test')
  const customer = await createCustomer(adminCookie)
  const survey = (await (await scheduleSurvey(adminCookie, customer.id)).json()).survey
  await submitFindings(survey.id, surveyorCookie)

  const missingReason = await fetch(`${baseUrl}/api/surveys/${survey.id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ action: 'REQUEST_CORRECTIONS', comments: ' ' }),
  })
  assert.equal(missingReason.status, 400)
  const correctionResponse = await fetch(`${baseUrl}/api/surveys/${survey.id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ action: 'REQUEST_CORRECTIONS', comments: 'Recheck cable route' }),
  })
  const corrections = (await correctionResponse.json()).survey
  assert.equal(corrections.status, 'CHANGES_REQUESTED')
  assert.equal(corrections.approvalHistory[0].decision, 'REQUEST_CORRECTIONS')

  const resubmitted = await fetch(`${baseUrl}/api/surveys/${survey.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: surveyorCookie },
    body: '{}',
  })
  assert.equal(resubmitted.status, 200)
  assert.equal((await resubmitted.json()).survey.status, 'PENDING_APPROVAL')
})

test('photo upload validates content, stores metadata and protects image retrieval', async () => {
  const adminCookie = await login('admin@survey.test')
  const surveyorCookie = await login('surveyor@survey.test')
  const otherSurveyorCookie = await login('surveyor.other@survey.test')
  const customer = await createCustomer(adminCookie)
  const survey = (await (await scheduleSurvey(adminCookie, customer.id)).json()).survey
  const photoUrl = `${baseUrl}/api/surveys/${survey.id}/photos`

  const invalidType = await fetch(photoUrl, {
    method: 'POST',
    headers: { Cookie: surveyorCookie, 'Content-Type': 'text/plain' },
    body: 'not an image',
  })
  assert.equal(invalidType.status, 415)
  const mismatchedImage = await fetch(photoUrl, {
    method: 'POST',
    headers: { Cookie: surveyorCookie, 'Content-Type': 'image/png' },
    body: Buffer.from('not a PNG'),
  })
  assert.equal(mismatchedImage.status, 415)
  const oversized = await fetch(photoUrl, {
    method: 'POST',
    headers: { Cookie: surveyorCookie, 'Content-Type': 'image/jpeg' },
    body: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  assert.equal(oversized.status, 413)

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=', 'base64')
  const upload = await fetch(photoUrl, {
    method: 'POST',
    headers: {
      Cookie: surveyorCookie,
      'Content-Type': 'image/png',
      'X-File-Name': '..\\roof-photo.png',
      'X-Attachment-Type': 'ROOF_PHOTO',
    },
    body: png,
  })
  const uploadedPhoto = (await upload.json()).photo
  assert.equal(upload.status, 201)
  assert.equal(uploadedPhoto.mediaType, 'image/png')
  assert.equal(uploadedPhoto.originalName, 'roof-photo.png')
  assert.equal('storageKey' in uploadedPhoto, false)

  const retrieved = await fetch(`${baseUrl}${uploadedPhoto.url}`, {
    headers: { Cookie: otherSurveyorCookie },
  })
  assert.equal(retrieved.status, 404)
  const authorizedPhoto = await fetch(`${baseUrl}${uploadedPhoto.url}`, {
    headers: { Cookie: surveyorCookie },
  })
  assert.equal(authorizedPhoto.status, 200)
  assert.equal(authorizedPhoto.headers.get('content-type'), 'image/png')
  assert.equal(Buffer.from(await authorizedPhoto.arrayBuffer()).compare(png), 0)
})

test('quotation release is blocked until the associated survey is approved', async () => {
  const adminCookie = await login('admin@survey.test')
  const surveyorCookie = await login('surveyor@survey.test')
  const customer = await createCustomer(adminCookie)
  const survey = (await (await scheduleSurvey(adminCookie, customer.id)).json()).survey
  const createQuote = await fetch(`${baseUrl}/api/quotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ surveyId: survey.id }),
  })
  const quote = (await createQuote.json()).quotation
  assert.equal(createQuote.status, 201)

  const blocked = await fetch(`${baseUrl}/api/quotations/${quote.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'RELEASED' }),
  })
  assert.equal(blocked.status, 409)
  assert.equal((await blocked.json()).error.code, 'SURVEY_APPROVAL_REQUIRED')

  await submitFindings(survey.id, surveyorCookie)
  const approval = await fetch(`${baseUrl}/api/surveys/${survey.id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ action: 'APPROVE', comments: '' }),
  })
  assert.equal(approval.status, 200)
  const released = await fetch(`${baseUrl}/api/quotations/${quote.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'RELEASED' }),
  })
  assert.equal(released.status, 200)
  assert.equal((await released.json()).quotation.status, 'RELEASED')

  const options = await fetch(`${baseUrl}/api/quotations/options`, {
    headers: { Cookie: adminCookie },
  })
  assert.equal((await options.json()).surveys[0].id, survey.id)
})

test('customer receives only survey information linked to their own account', async () => {
  const adminCookie = await login('admin@survey.test')
  const ownCustomer = await createCustomer(adminCookie)
  const portalCustomerId = insertUser('CUSTOMER', 'portal.customer@survey.test')
  database.prepare('UPDATE customers SET linked_user_id = NULL WHERE linked_user_id = ?')
    .run(portalCustomerId)
  database.prepare('UPDATE customers SET linked_user_id = ? WHERE id = ?')
    .run(portalCustomerId, ownCustomer.id)
  const ownResponse = await scheduleSurvey(adminCookie, ownCustomer.id)
  assert.equal(ownResponse.status, 201)
  const ownSurvey = (await ownResponse.json()).survey
  const otherCustomer = await createCustomer(adminCookie)
  const otherResponse = await scheduleSurvey(adminCookie, otherCustomer.id)
  assert.equal(otherResponse.status, 201)
  const otherSurvey = (await otherResponse.json()).survey
  const customerCookie = await login('portal.customer@survey.test')
  const surveys = await fetch(`${baseUrl}/api/surveys`, {
    headers: { Cookie: customerCookie },
  })
  const customerSurveys = (await surveys.json()).surveys
  assert.deepEqual(customerSurveys.map((survey) => survey.id), [ownSurvey.id])
  assert.equal('shadowFreeRoofAreaSqm' in customerSurveys[0], false)
  assert.equal('assignedSurveyorEmail' in customerSurveys[0], false)
  const ownDetails = await fetch(`${baseUrl}/api/surveys/${ownSurvey.id}`, {
    headers: { Cookie: customerCookie },
  })
  const ownDetailsBody = (await ownDetails.json()).survey
  assert.equal(ownDetails.status, 200)
  assert.equal('approvalHistory' in ownDetailsBody, false)
  assert.equal('photos' in ownDetailsBody, false)
  const other = await fetch(`${baseUrl}/api/surveys/${otherSurvey.id}`, {
    headers: { Cookie: customerCookie },
  })
  assert.equal(other.status, 404)
})

test('survey records persist after closing and reopening SQLite', async () => {
  const adminCookie = await login('admin@survey.test')
  const customer = await createCustomer(adminCookie)
  const survey = (await (await scheduleSurvey(adminCookie, customer.id)).json()).survey
  await stopServer()
  database.close()
  database = openDatabase(config.databasePath)
  initializeDatabase(database)
  await startServer()

  const persisted = await fetch(`${baseUrl}/api/surveys/${survey.id}`, {
    headers: { Cookie: adminCookie },
  })
  assert.equal(persisted.status, 200)
  assert.equal((await persisted.json()).survey.customerId, customer.id)
})
