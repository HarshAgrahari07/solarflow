import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, test } from 'node:test'
import { createApp } from '../src/app.js'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import { seedDemoBusiness } from '../src/services/businessDemoSeedService.js'

let database
let server
let baseUrl
let password
let customerUserId
let otherCustomerUserId
let factoryCustomerUserId
let userIds

function insertUser(role, email) {
  const id = randomUUID()
  database.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, `Workflow ${role}`, email, bcrypt.hashSync(password, 4), role)
  return id
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';', 1)[0]
}

async function request(path, cookie, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { response, payload: await response.json() }
}

beforeEach(async () => {
  password = randomBytes(18).toString('base64url')
  database = openDatabase(':memory:')
  initializeDatabase(database)
  userIds = {
    admin: insertUser('ADMIN', 'admin@workflow.test'),
    sales: insertUser('SALES', 'sales@workflow.test'),
    warehouse: insertUser('WAREHOUSE', 'warehouse@workflow.test'),
    technician: insertUser('TECHNICIAN', 'technician@workflow.test'),
    otherTechnician: insertUser('TECHNICIAN', 'other.technician@workflow.test'),
    support: insertUser('SUPPORT', 'support@workflow.test'),
    finance: insertUser('FINANCE', 'finance@workflow.test'),
  }
  database.prepare('UPDATE users SET created_at = ? WHERE id = ?')
    .run('2025-01-01T00:00:00.000Z', userIds.technician)
  database.prepare('UPDATE users SET created_at = ? WHERE id = ?')
    .run('2025-01-02T00:00:00.000Z', userIds.otherTechnician)
  seedDemoBusiness(database)
  customerUserId = insertUser('CUSTOMER', 'customer@workflow.test')
  otherCustomerUserId = insertUser('CUSTOMER', 'other.customer@workflow.test')
  factoryCustomerUserId = insertUser('CUSTOMER', 'factory.customer@workflow.test')
  database.prepare('UPDATE customers SET linked_user_id = NULL WHERE linked_user_id IN (?, ?, ?)')
    .run(customerUserId, otherCustomerUserId, factoryCustomerUserId)
  database.prepare('UPDATE customers SET linked_user_id = ? WHERE id = ?')
    .run(customerUserId, 'demo-customer-home-complete')
  database.prepare('UPDATE customers SET linked_user_id = ? WHERE id = ?')
    .run(otherCustomerUserId, 'demo-customer-home-ongoing')
  database.prepare('UPDATE customers SET linked_user_id = ? WHERE id = ?')
    .run(factoryCustomerUserId, 'demo-customer-factory-pending')

  const config = {
    nodeEnv: 'test',
    jwtSecret: randomBytes(48).toString('base64url'),
    databasePath: ':memory:',
    fileStoragePath: 'unused-in-workflow-tests',
    frontendOrigin: 'http://localhost:5173',
  }
  server = createServer(createApp({ database, config }))
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
  if (database?.open) database.close()
})

test('customers see only their own orders, installation assignments, and service records', async () => {
  const customerCookie = await login('customer@workflow.test')
  const technicianCookie = await login('technician@workflow.test')
  const otherTechnicianCookie = await login('other.technician@workflow.test')

  const orders = await request('/api/operations/orders', customerCookie)
  assert.equal(orders.response.status, 200)
  assert.deepEqual(orders.payload.orders.map((order) => order.id), ['demo-order-complete'])

  const otherOrder = await request('/api/operations/orders/demo-order-ongoing', customerCookie)
  assert.equal(otherOrder.response.status, 404)

  const assignments = await request('/api/operations/installations', otherTechnicianCookie)
  assert.equal(assignments.response.status, 200)
  assert.deepEqual(assignments.payload.installations, [])
  const technicianJobs = await request('/api/operations/installations', technicianCookie)
  assert.deepEqual(technicianJobs.payload.installations.map((job) => job.id), ['installation-demo-order-complete'])

  const created = await request('/api/operations/service-tickets', customerCookie, {
    method: 'POST',
    body: {
      subject: 'Demo serial inspection',
      description: 'Synthetic test request',
      serialNumber: 'DEMO-INVERTER-SERIAL-001',
    },
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.payload.ticket.customerId, 'demo-customer-home-complete')

  const otherCustomerCookie = await login('other.customer@workflow.test')
  const otherTickets = await request('/api/operations/service-tickets', otherCustomerCookie)
  assert.equal(otherTickets.response.status, 200)
  assert.deepEqual(otherTickets.payload.tickets, [])
  const privateReport = await request('/api/operations/finance/report', customerCookie)
  assert.equal(privateReport.response.status, 403)
})

test('delivered serial lookup returns configured warranty data and enforces customer ownership', async () => {
  const supportCookie = await login('support@workflow.test')
  const customerCookie = await login('customer@workflow.test')
  const otherCustomerCookie = await login('other.customer@workflow.test')
  const expected = [
    { serialNumber: 'DEMO-INVERTER-SERIAL-001', productType: 'INVERTER', productName: 'Demo inverter', endsOn: '2028-11-20' },
    { serialNumber: 'DEMO-PANEL-SERIAL-001', productType: 'PANEL', productName: 'Demo solar panels', endsOn: '2046-11-20' },
    { serialNumber: 'DEMO-BATTERY-SERIAL-001', productType: 'BATTERY', productName: 'Demo large battery', endsOn: '2028-11-20' },
    { serialNumber: 'DEMO-CONTROLLER-SERIAL-001', productType: 'CHARGE_CONTROLLER', productName: 'Demo charge controller', endsOn: null },
  ]

  for (const item of expected) {
    const result = await request(`/api/operations/serials/${item.serialNumber}`, supportCookie)
    assert.equal(result.response.status, 200, result.payload.error?.message)
    assert.equal(result.payload.equipment.productType, item.productType)
    assert.equal(result.payload.equipment.productName, item.productName)
    assert.equal(result.payload.equipment.customerId, 'demo-customer-home-complete')
    assert.equal(result.payload.equipment.customerName, 'Demo Customer One')
    assert.equal(result.payload.equipment.warranty.startsOn, '2026-11-20')
    assert.equal(result.payload.equipment.warranty.startsOn, result.payload.equipment.deliveryCompletedAt.slice(0, 10))
    assert.equal(result.payload.equipment.warranty.endsOn, item.endsOn)
    assert.equal(
      result.payload.equipment.warranty.status,
      item.productType === 'CHARGE_CONTROLLER' ? 'UNSPECIFIED' : 'ACTIVE',
    )
  }

  const ownedSerial = await request('/api/operations/serials/DEMO-INVERTER-SERIAL-001', customerCookie)
  assert.equal(ownedSerial.response.status, 200)
  const privateSerial = await request('/api/operations/serials/DEMO-INVERTER-SERIAL-001', otherCustomerCookie)
  assert.equal(privateSerial.response.status, 404)
  assert.equal(privateSerial.payload.error.code, 'SERIAL_NOT_FOUND')

  const unknownSerial = await request('/api/operations/serials/UNKNOWN-SERIAL', supportCookie)
  assert.equal(unknownSerial.response.status, 404)
  assert.equal(unknownSerial.payload.error.code, 'SERIAL_NOT_FOUND')
})

test('accepted quotations become confirmed orders with persistent dispatch and installation records', async () => {
  const adminCookie = await login('admin@workflow.test')
  const salesCookie = await login('sales@workflow.test')
  const customerCookie = await login('factory.customer@workflow.test')
  database.prepare(`
    INSERT INTO survey_approvals (id, survey_id, reviewer_user_id, decision, notes)
    VALUES (?, 'demo-survey-pending', ?, 'APPROVED', 'Synthetic test approval')
  `).run(randomUUID(), userIds.admin)

  const released = await request('/api/quotations/demo-quote-pending/status', salesCookie, {
    method: 'PATCH',
    body: { status: 'RELEASED' },
  })
  assert.equal(released.response.status, 200)

  const accepted = await request('/api/quotations/demo-quote-pending/respond', customerCookie, {
    method: 'POST',
    body: { decision: 'ACCEPT', comments: 'Synthetic test acceptance' },
  })
  assert.equal(accepted.response.status, 200)
  assert.equal(accepted.payload.quotation.status, 'ACCEPTED')

  const created = await request('/api/operations/orders', salesCookie, {
    method: 'POST',
    body: { quoteId: 'demo-quote-pending', requiredAdvanceAmount: 0.5 },
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.payload.order.status, 'DRAFT')

  const confirmed = await request(`/api/operations/orders/${created.payload.order.id}/confirm`, adminCookie, {
    method: 'POST',
    body: {},
  })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.order.status, 'CONFIRMED')
  assert.ok(confirmed.payload.order.dispatch)
  assert.ok(confirmed.payload.order.installation)

  const scheduled = await request(
    `/api/operations/installations/${confirmed.payload.order.installation.id}/schedule`,
    adminCookie,
    {
      method: 'PATCH',
      body: {
        scheduledStart: '2026-12-01T09:00:00.000Z',
        scheduledEnd: '2026-12-01T17:00:00.000Z',
        technicianIds: [userIds.technician],
      },
    },
  )
  assert.equal(scheduled.response.status, 200)
  assert.equal(scheduled.payload.installation.assignments[0].userId, userIds.technician)

  const customerInstallations = await request('/api/operations/installations', customerCookie)
  assert.ok(customerInstallations.payload.installations.some((job) => job.id === scheduled.payload.installation.id))
  const otherCustomerCookie = await login('other.customer@workflow.test')
  const privateJob = await request(
    `/api/operations/installations/${scheduled.payload.installation.id}`,
    otherCustomerCookie,
  )
  assert.equal(privateJob.response.status, 404)
})

test('finance APIs are role-scoped and invoices snapshot priced accepted-order lines', async () => {
  const adminCookie = await login('admin@workflow.test')
  const financeCookie = await login('finance@workflow.test')
  const warehouseCookie = await login('warehouse@workflow.test')
  const supportCookie = await login('support@workflow.test')

  const adminReport = await request('/api/operations/finance/report', adminCookie)
  assert.equal(adminReport.response.status, 200)
  const adminTickets = await request('/api/operations/service-tickets', adminCookie)
  assert.equal(adminTickets.response.status, 200)
  const supportTickets = await request('/api/operations/service-tickets', supportCookie)
  assert.equal(supportTickets.response.status, 200)
  const forbidden = await request('/api/operations/finance/report', warehouseCookie)
  assert.equal(forbidden.response.status, 403)
  const supportForbidden = await request('/api/operations/finance/report', supportCookie)
  assert.equal(supportForbidden.response.status, 403)

  const payableOrder = await request('/api/operations/orders/demo-order-ongoing', financeCookie)
  assert.ok(payableOrder.payload.order.outstandingAmount > 0)
  const overpayment = await request('/api/operations/orders/demo-order-ongoing/payments', financeCookie, {
    method: 'POST',
    body: {
      type: 'ADVANCE',
      amount: payableOrder.payload.order.outstandingAmount + 1,
      method: 'BANK_TRANSFER',
    },
  })
  assert.equal(overpayment.response.status, 409)
  assert.equal(overpayment.payload.error.code, 'PAYMENT_EXCEEDS_BALANCE')

  const created = await request('/api/operations/finance/invoices', financeCookie, {
    method: 'POST',
    body: { orderId: 'demo-order-complete', dueAt: '2026-12-01T00:00:00.000Z' },
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.payload.invoice.status, 'DRAFT')
  const issued = await request(`/api/operations/finance/invoices/${created.payload.invoice.id}/status`, financeCookie, {
    method: 'PATCH',
    body: { status: 'ISSUED' },
  })
  assert.equal(issued.response.status, 200)
  assert.equal(issued.payload.invoice.status, 'ISSUED')

  const report = await request('/api/operations/finance/report?from=2026-01-01&to=2026-12-31', financeCookie)
  assert.equal(report.response.status, 200)
  assert.ok(report.payload.report.projectCount > 0)
  assert.ok(report.payload.report.incompleteProjectCount >= 0)
  assert.deepEqual(
    report.payload.report.operations.installationStatuses,
    database.prepare('SELECT status, count(*) AS count FROM installation_jobs GROUP BY status ORDER BY status').all(),
  )
  assert.deepEqual(
    report.payload.report.operations.serviceTicketStatuses,
    database.prepare('SELECT status, count(*) AS count FROM service_tickets GROUP BY status ORDER BY status').all(),
  )

  const financeTicketForbidden = await request('/api/operations/service-tickets', financeCookie)
  assert.equal(financeTicketForbidden.response.status, 403)
})

test('finance payroll is limited to assigned technician time and explicit rates or amounts', async () => {
  const financeCookie = await login('finance@workflow.test')
  database.prepare(`
    INSERT INTO installation_time_logs (
      id, job_id, technician_user_id, started_at, ended_at, hours, notes
    ) VALUES (?, 'installation-demo-order-complete', ?, ?, ?, 2, 'Synthetic logged hours')
  `).run(
    randomUUID(),
    userIds.technician,
    '2026-11-02T09:00:00.000Z',
    '2026-11-02T11:00:00.000Z',
  )

  const options = await request('/api/operations/finance/payroll/options', financeCookie)
  const option = options.payload.options.find((item) => item.technicianUserId === userIds.technician)
  assert.ok(option)
  assert.equal(option.availableHours, 1)

  const tooManyHours = await request('/api/operations/finance/payroll', financeCookie, {
    method: 'POST',
    body: {
      jobId: option.jobId,
      technicianUserId: option.technicianUserId,
      hours: 2,
      hourlyRate: 50,
    },
  })
  assert.equal(tooManyHours.response.status, 409)

  const entry = await request('/api/operations/finance/payroll', financeCookie, {
    method: 'POST',
    body: {
      jobId: option.jobId,
      technicianUserId: option.technicianUserId,
      hours: 1,
      amount: 75,
      notes: 'Configured test payroll',
    },
  })
  assert.equal(entry.response.status, 201)
  assert.equal(entry.payload.payroll.amount, 75)
})

test('stock purchases receive bulk and uniquely serialized stock through audited movements', async () => {
  const financeCookie = await login('finance@workflow.test')
  const warehouseCookie = await login('warehouse@workflow.test')

  const created = await request('/api/operations/finance/purchases', financeCookie, {
    method: 'POST',
    body: {
      warehouseId: 'demo-warehouse-central',
      supplierName: 'Synthetic test supplier',
      purchasedAt: '2026-11-20T10:00:00.000Z',
      items: [
        { inventoryItemId: 'demo-item-inverter', quantity: 1, unitCost: 0 },
        { inventoryItemId: 'demo-item-panels', quantity: 2 },
      ],
    },
  })
  assert.equal(created.response.status, 201)
  const purchase = created.payload.purchase
  const serializedItem = purchase.items.find((item) => item.tracksSerial)
  assert.ok(serializedItem)

  const invalidReceive = await request(`/api/operations/finance/purchases/${purchase.id}/receive`, warehouseCookie, {
    method: 'POST',
    body: { serials: [] },
  })
  assert.equal(invalidReceive.response.status, 400)
  assert.equal(database.prepare('SELECT status FROM stock_purchases WHERE id = ?').get(purchase.id).status, 'ORDERED')

  const received = await request(`/api/operations/finance/purchases/${purchase.id}/receive`, warehouseCookie, {
    method: 'POST',
    body: {
      serials: [{
        purchaseItemId: serializedItem.id,
        serialNumbers: ['WORKFLOW-NEW-INVERTER-001'],
      }],
    },
  })
  assert.equal(received.response.status, 200)
  assert.equal(received.payload.purchase.status, 'RECEIVED')
  assert.equal(database.prepare(`
    SELECT count(*) AS count FROM stock_movements
    WHERE reference_type = 'PURCHASE' AND reference_id = ?
  `).get(purchase.id).count, 2)
})

test('warehouse dispatch workflow reserves stock and advances through delivery', async () => {
  const warehouseCookie = await login('warehouse@workflow.test')
  database.prepare(`
    UPDATE quotation_items SET product_type = 'PANEL'
    WHERE quotation_id = 'demo-quote-ongoing'
  `).run()

  const reserved = await request('/api/operations/dispatches/dispatch-demo-order-ongoing/warehouse', warehouseCookie, {
    method: 'PATCH',
    body: { warehouseId: 'demo-warehouse-central' },
  })
  assert.equal(reserved.response.status, 200)
  assert.equal(database.prepare(`
    SELECT count(*) AS count FROM stock_movements
    WHERE reference_id = 'dispatch-demo-order-ongoing' AND movement_type = 'RESERVE'
  `).get().count, 1)

  database.prepare(`
    INSERT INTO warehouses (id, code, name, address)
    VALUES ('test-alternative-warehouse', 'TEST-ALT', 'Test alternative warehouse', 'Synthetic test address')
  `).run()
  const alternativeWarehouse = database.prepare(`
    SELECT id FROM warehouses WHERE id <> 'demo-warehouse-central' LIMIT 1
  `).get()
  assert.ok(alternativeWarehouse)
  const changedWarehouse = await request('/api/operations/dispatches/dispatch-demo-order-ongoing/warehouse', warehouseCookie, {
    method: 'PATCH',
    body: { warehouseId: alternativeWarehouse.id },
  })
  assert.equal(changedWarehouse.response.status, 409)
  assert.equal(changedWarehouse.payload.error.code, 'DISPATCH_WAREHOUSE_LOCKED')

  for (const status of ['READY', 'DISPATCHED', 'DELIVERED']) {
    const updated = await request('/api/operations/dispatches/dispatch-demo-order-ongoing/status', warehouseCookie, {
      method: 'PATCH',
      body: { status },
    })
    assert.equal(updated.response.status, 200, updated.payload.error?.message)
    assert.equal(updated.payload.dispatch.status, status)
  }
  assert.equal(database.prepare(`
    SELECT count(*) AS count FROM stock_movements
    WHERE reference_id = 'dispatch-demo-order-ongoing' AND movement_type = 'ISSUE'
  `).get().count, 1)
})

test('support resolution requires explicit charges outside active warranty and customer confirmation', async () => {
  const supportCookie = await login('support@workflow.test')
  const customerCookie = await login('customer@workflow.test')
  const otherCustomerCookie = await login('other.customer@workflow.test')
  database.prepare(`
    UPDATE warranty_records
    SET starts_on = date('now', '-1 day'), ends_on = date('now', '+1 year')
    WHERE product_serial_id = 'demo-serial-inverter-1'
  `).run()
  const created = await request('/api/operations/service-tickets', supportCookie, {
    method: 'POST',
    body: {
      customerId: 'demo-customer-home-complete',
      subject: 'Synthetic service request',
      description: 'Inspect the delivered system',
      serialNumber: 'DEMO-INVERTER-SERIAL-001',
    },
  })
  assert.equal(created.response.status, 201)
  const ticketId = created.payload.ticket.id
  assert.equal(created.payload.ticket.status, 'OPEN')

  const assigned = await request(`/api/operations/service-tickets/${ticketId}/assignment`, supportCookie, {
    method: 'PATCH',
    body: { supportUserId: userIds.support },
  })
  assert.equal(assigned.response.status, 200)
  assert.equal(assigned.payload.ticket.status, 'IN_PROGRESS')

  const noChargeDetails = await request(`/api/operations/service-tickets/${ticketId}/resolve`, supportCookie, {
    method: 'POST',
    body: { type: 'REPAIR', partsCharge: 500, labourCharge: 250, notes: 'Synthetic resolution' },
  })
  assert.equal(noChargeDetails.response.status, 200)
  assert.equal(noChargeDetails.payload.ticket.resolutions[0].warrantyCoverage, 'COVERED')
  assert.equal(noChargeDetails.payload.ticket.status, 'WAITING_CUSTOMER')
  assert.equal(database.prepare(`
    SELECT parts_charge, labour_charge FROM service_resolutions WHERE ticket_id = ?
  `).get(ticketId).parts_charge, 0)
  assert.equal(database.prepare(`
    SELECT labour_charge FROM service_resolutions WHERE ticket_id = ?
  `).get(ticketId).labour_charge, 0)

  const privateConfirmation = await request(`/api/operations/service-tickets/${ticketId}/confirm`, otherCustomerCookie, {
    method: 'POST',
    body: { confirmed: true, notes: 'Not the ticket owner' },
  })
  assert.equal(privateConfirmation.response.status, 404)

  const moreHelp = await request(`/api/operations/service-tickets/${ticketId}/confirm`, customerCookie, {
    method: 'POST',
    body: { confirmed: false, notes: 'Please provide further help.' },
  })
  assert.equal(moreHelp.response.status, 200)
  assert.equal(moreHelp.payload.ticket.status, 'IN_PROGRESS')

  const confirmedResolution = await request(`/api/operations/service-tickets/${ticketId}/resolve`, supportCookie, {
    method: 'POST',
    body: { type: 'REPLACEMENT', partsCharge: 0, labourCharge: 0, notes: 'Replacement completed.' },
  })
  assert.equal(confirmedResolution.response.status, 200)
  assert.equal(confirmedResolution.payload.ticket.status, 'WAITING_CUSTOMER')

  const confirmed = await request(`/api/operations/service-tickets/${ticketId}/confirm`, customerCookie, {
    method: 'POST',
    body: { confirmed: true, notes: 'Synthetic confirmation' },
  })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.ticket.status, 'CLOSED')
  assert.equal(database.prepare('SELECT status FROM service_tickets WHERE id = ?').get(ticketId).status, 'CLOSED')

  const nonWarrantyTicket = await request('/api/operations/service-tickets', supportCookie, {
    method: 'POST',
    body: {
      customerId: 'demo-customer-home-complete',
      subject: 'Unspecified equipment service',
      description: 'No serial record supplied',
    },
  })
  const chargeRequired = await request(
    `/api/operations/service-tickets/${nonWarrantyTicket.payload.ticket.id}/resolve`,
    supportCookie,
    { method: 'POST', body: { type: 'ADVICE', notes: 'Synthetic test' } },
  )
  assert.equal(chargeRequired.response.status, 400)
  assert.equal(chargeRequired.payload.error.code, 'SERVICE_CHARGES_REQUIRED')

  const chargedResolution = await request(
    `/api/operations/service-tickets/${nonWarrantyTicket.payload.ticket.id}/resolve`,
    supportCookie,
    {
      method: 'POST',
      body: { type: 'REPLACEMENT', partsCharge: 120, labourCharge: 80, notes: 'Configured non-warranty charges.' },
    },
  )
  assert.equal(chargedResolution.response.status, 200)
  assert.equal(chargedResolution.payload.ticket.status, 'WAITING_CUSTOMER')
  assert.equal(chargedResolution.payload.ticket.resolutions[0].warrantyCoverage, 'NOT_COVERED')
  assert.equal(chargedResolution.payload.ticket.resolutions[0].partsCharge, 120)
  assert.equal(chargedResolution.payload.ticket.resolutions[0].labourCharge, 80)
})
