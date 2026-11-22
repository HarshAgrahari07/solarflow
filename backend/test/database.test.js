import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openDatabase } from '../src/database/connection.js'
import { initializeDatabase } from '../src/database/schema.js'
import { runMigrations } from '../src/database/migrate.js'
import { seedDemoBusiness } from '../src/services/businessDemoSeedService.js'
import { resolveManagedFilePath, writeManagedFile } from '../src/services/fileStorage.js'

function openMigratedDatabase() {
  const database = openDatabase(':memory:')
  initializeDatabase(database)
  return database
}

function insertUser(database, role, email = `${role.toLowerCase()}@example.test`) {
  const id = randomUUID()
  database.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role)
    VALUES (?, ?, ?, 'test-only-hash', ?)
  `).run(id, `Example ${role}`, email, role)
  return id
}

function addDemoSeedUsers(database) {
  insertUser(database, 'SALES')
  insertUser(database, 'TECHNICIAN')
}

function seedDatabase() {
  const database = openMigratedDatabase()
  addDemoSeedUsers(database)
  seedDemoBusiness(database)
  return database
}

test('versioned migrations preserve an existing users-only database and are repeatable', () => {
  const database = openDatabase(':memory:')
  try {
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT '2025-01-01T00:00:00.000Z',
        updated_at TEXT NOT NULL DEFAULT '2025-01-01T00:00:00.000Z'
      );
      INSERT INTO users (id, full_name, email, password_hash, role, is_active)
      VALUES
        ('legacy-admin', 'Legacy Admin', 'legacy.admin@example.test', 'unchanged-admin-hash', 'ADMIN', 1),
        ('legacy-customer', 'Legacy Customer', 'legacy.customer@example.test', 'unchanged-customer-hash', 'CUSTOMER', 0);
    `)

    const migrations = initializeDatabase(database)
    const originalRows = database.prepare(`
      SELECT id, full_name, email, password_hash, role, is_active
      FROM users ORDER BY id
    `).all()
    const firstCounts = {
      users: database.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      customers: database.prepare('SELECT COUNT(*) AS count FROM customers').get().count,
      leads: database.prepare('SELECT COUNT(*) AS count FROM leads').get().count,
      migrations: database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count,
    }

    assert.deepEqual(migrations.map((migration) => migration.version), [1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(database.prepare(`
      SELECT id, full_name, email, password_hash, role, is_active
      FROM users ORDER BY id
    `).all(), originalRows)
    assert.equal(
      database.prepare('SELECT linked_user_id FROM customers WHERE linked_user_id = ?')
        .get('legacy-customer').linked_user_id,
      'legacy-customer',
    )
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM follow_ups').get().count,
      0,
    )

    initializeDatabase(database)
    assert.deepEqual({
      users: database.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      customers: database.prepare('SELECT COUNT(*) AS count FROM customers').get().count,
      leads: database.prepare('SELECT COUNT(*) AS count FROM leads').get().count,
      migrations: database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count,
    }, firstCounts)

    assert.throws(() => database.prepare(`
      INSERT INTO leads (id, lead_number, customer_id)
      VALUES ('bad-lead', 'BAD-LEAD', 'missing-customer')
    `).run(), /FOREIGN KEY constraint failed/)
  } finally {
    database.close()
  }
})

test('a failed migration reports its version and rolls back its schema changes', () => {
  const database = openDatabase(':memory:')
  try {
    assert.throws(
      () => runMigrations(database, [{
        version: 1,
        name: 'deliberate-test-failure',
        up(connection) {
          connection.exec('CREATE TABLE migration_marker (id TEXT PRIMARY KEY)')
          throw new Error('test failure detail')
        },
      }]),
      /migration 1 \(deliberate-test-failure\).*rolled back: test failure detail/,
    )
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'migration_marker'").get().count,
      0,
    )
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 0)
  } finally {
    database.close()
  }
})

test('migration history rejects gaps instead of applying an older schema version', () => {
  const database = openDatabase(':memory:')
  const migration = (version) => ({
    version,
    name: `test-migration-${version}`,
    up(connection) {
      connection.exec(`CREATE TABLE migration_${version} (id TEXT PRIMARY KEY)`)
    },
  })

  try {
    runMigrations(database, [migration(1)])
    database.prepare(`
      INSERT INTO schema_migrations (version, name) VALUES (3, 'test-migration-3')
    `).run()
    assert.throws(
      () => runMigrations(database, [migration(1), migration(2), migration(3)]),
      /history has a gap before version 3/,
    )
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 2)
    assert.equal(database.pragma('foreign_key_check').length, 0)
  } finally {
    database.close()
  }
})

test('existing CRM follow-ups migrate without data loss and retain the legacy API view', () => {
  const database = openDatabase(':memory:')
  try {
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        phone TEXT,
        address TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY NOT NULL,
        linked_user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        category TEXT,
        solar_requirement TEXT,
        capacity_kw REAL,
        lead_status TEXT NOT NULL DEFAULT 'New',
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT NOT NULL DEFAULT '',
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE customer_follow_ups (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        assigned_to TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        due_at TEXT NOT NULL,
        note TEXT NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO users (id, full_name, email, password_hash, role, created_at, updated_at)
      VALUES
        ('legacy-sales', 'Legacy Sales', 'legacy.sales@example.test', 'unchanged-hash', 'SALES', '2025-01-01', '2025-01-01'),
        ('legacy-customer-user', 'Legacy Customer', 'legacy.customer@example.test', 'customer-hash', 'CUSTOMER', '2025-01-01', '2025-01-01');
      INSERT INTO customers (
        id, linked_user_id, full_name, email, phone, address,
        lead_status, assigned_to, notes, created_at, updated_at
      ) VALUES (
        'legacy-crm-customer', NULL, 'Legacy CRM Customer', 'lead@example.test',
        '0000000000', 'Legacy Example Address', 'Contacted', 'legacy-sales',
        'Preserve this CRM note.', '2025-01-01', '2025-01-02'
      );
      INSERT INTO customer_follow_ups (
        id, customer_id, assigned_to, created_by, due_at, note,
        completed_at, created_at, updated_at
      ) VALUES (
        'legacy-follow-up', 'legacy-crm-customer', 'legacy-sales', 'legacy-sales',
        '2025-01-10T09:00:00.000Z', 'Preserve this follow-up.',
        NULL, '2025-01-01', '2025-01-01'
      );
    `)

    initializeDatabase(database)
    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count FROM customer_follow_ups_legacy_v1
    `).get().count, 1)
    assert.deepEqual(database.prepare(`
      SELECT id, lead_id, assigned_to, note FROM follow_ups WHERE id = 'legacy-follow-up'
    `).get(), {
      id: 'legacy-follow-up',
      lead_id: 'lead-legacy-crm-customer',
      assigned_to: 'legacy-sales',
      note: 'Preserve this follow-up.',
    })
    assert.equal(database.prepare(`
      SELECT lead_status || '|' || notes FROM customers WHERE id = 'legacy-crm-customer'
    `).pluck().get(), 'Contacted|Preserve this CRM note.')
    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count FROM customer_follow_ups
    `).get().count, 1)
    database.prepare(`
      UPDATE customer_follow_ups SET completed_at = ? WHERE id = ?
    `).run('2025-01-11T09:00:00.000Z', 'legacy-follow-up')
    assert.equal(database.prepare(`
      SELECT completed_at FROM follow_ups WHERE id = 'legacy-follow-up'
    `).get().completed_at, '2025-01-11T09:00:00.000Z')
    assert.equal(database.prepare(`
      SELECT password_hash FROM users WHERE id = 'legacy-customer-user'
    `).get().password_hash, 'customer-hash')
    assert.deepEqual(database.pragma('foreign_key_check'), [])
  } finally {
    database.close()
  }
})

test('new workflow records persist across database close and reopen', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solarflow-workflow-persistence-'))
  const databasePath = path.join(directory, 'workflow.sqlite')
  let database
  try {
    database = openDatabase(databasePath)
    initializeDatabase(database)
    database.prepare(`
      INSERT INTO customers (id, full_name, email, category, capacity_kw)
      VALUES ('persistent-workflow-customer', 'Persistent Example', 'persistent@example.test', 'Small Factory', 5)
    `).run()
    database.close()

    database = openDatabase(databasePath)
    initializeDatabase(database)
    assert.deepEqual(database.prepare(`
      SELECT id, category, capacity_kw FROM customers WHERE id = 'persistent-workflow-customer'
    `).get(), {
      id: 'persistent-workflow-customer',
      category: 'Small Factory',
      capacity_kw: 5,
    })
    assert.equal(database.prepare(`
      SELECT status FROM leads WHERE customer_id = 'persistent-workflow-customer'
    `).get().status, 'New')
    assert.deepEqual(database.pragma('foreign_key_check'), [])
  } finally {
    if (database && database.open) database.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('synthetic business seed is idempotent and keeps valid relational references', () => {
  const database = openMigratedDatabase()
  try {
    addDemoSeedUsers(database)
    const usersBefore = database.prepare('SELECT COUNT(*) AS count FROM users').get().count
    const first = seedDemoBusiness(database)
    const countsBefore = database.prepare(`
      SELECT entity_type, COUNT(*) AS count
      FROM demo_seed_records WHERE batch_id = ?
      GROUP BY entity_type ORDER BY entity_type
    `).all(first.batchId)

    const second = seedDemoBusiness(database)
    const countsAfter = database.prepare(`
      SELECT entity_type, COUNT(*) AS count
      FROM demo_seed_records WHERE batch_id = ?
      GROUP BY entity_type ORDER BY entity_type
    `).all(first.batchId)

    assert.deepEqual(second, first)
    assert.deepEqual(countsAfter, countsBefore)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count, usersBefore)
    assert.deepEqual(database.pragma('foreign_key_check'), [])
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM customers').get().count, 3)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM leads').get().count, 3)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM surveys').get().count, 3)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM quotations').get().count, 3)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM dispatches').get().count, 2)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM installation_jobs').get().count, 2)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM service_tickets').get().count, 1)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM warranty_records').get().count, 4)
    const payroll = database.prepare(`
      SELECT hours, hourly_rate, amount, paid_at
      FROM technician_payroll_entries WHERE id = 'demo-technician-payroll'
    `).get()
    assert.deepEqual(payroll, { hours: 1, hourly_rate: null, amount: null, paid_at: null })
    const profitability = database.prepare(`
      SELECT costs_complete, project_cost_amount, project_profit_amount
      FROM v_project_profitability WHERE order_id = 'demo-order-complete'
    `).get()
    assert.deepEqual(profitability, {
      costs_complete: 0,
      project_cost_amount: null,
      project_profit_amount: null,
    })
  } finally {
    database.close()
  }
})

test('database constraints enforce capacity, serial uniqueness, BOM composition, and payment gates', () => {
  const database = seedDatabase()
  try {
    for (const [email, capacity] of [
      ['too-small@example.test', 0.99],
      ['too-large@example.test', 5.01],
    ]) {
      assert.throws(() => database.prepare(`
        INSERT INTO customers (id, full_name, email, category, capacity_kw)
        VALUES (?, 'Capacity Boundary', ?, 'Home', ?)
      `).run(randomUUID(), email, capacity), /CHECK constraint failed/)
    }
    for (const [email, capacity] of [
      ['minimum-capacity@example.test', 1],
      ['maximum-capacity@example.test', 5],
    ]) {
      database.prepare(`
        INSERT INTO customers (id, full_name, email, category, capacity_kw)
        VALUES (?, 'Capacity Boundary', ?, 'Home', ?)
      `).run(randomUUID(), email, capacity)
    }

    assert.throws(() => database.prepare(`
      INSERT INTO product_serials (id, inventory_item_id, warehouse_id, serial_number)
      VALUES ('duplicate-serial', 'demo-item-inverter', 'demo-warehouse-central', 'DEMO-INVERTER-SERIAL-001')
    `).run(), /UNIQUE constraint failed/)

    const itemsFor = (templateId) => database.prepare(`
      SELECT component_code, quantity FROM package_template_items
      WHERE template_id = ? ORDER BY component_code
    `).all(templateId)
    const offGrid = new Set(itemsFor('demo-package-off-grid').map((item) => item.component_code))
    for (const required of [
      'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS',
      'SAFETY_EARTHING', 'METAL_STANDS', 'LARGE_BATTERY',
    ]) {
      assert.ok(offGrid.has(required), `Off-grid BOM must include ${required}`)
    }
    assert.ok(offGrid.has('SWITCHES'))
    assert.ok(offGrid.has('WIRES'))
    assert.ok(offGrid.has('SAFETY_PARTS'))
    assert.ok(itemsFor('demo-package-off-grid').every((item) => item.quantity === null))
    assert.deepEqual(
      itemsFor('demo-package-on-grid').map((item) => item.component_code).sort(),
      [
        'CHARGE_CONTROLLER', 'INVERTER', 'METAL_STANDS', 'PANELS',
        'SAFETY_EARTHING', 'SAFETY_PARTS', 'SWITCHES', 'WIRES', 'WIRING_BOXES',
      ],
    )
    assert.deepEqual(
      itemsFor('demo-package-solar-panel-set').map((item) => item.component_code).sort(),
      ['CONNECTORS', 'PANELS', 'WIRES'],
    )
    assert.deepEqual(
      itemsFor('demo-package-installation').map((item) => item.component_code),
      ['INSTALLATION_SERVICE'],
    )
    assert.equal(
      database.pragma('table_info(package_template_items)').some((column) => column.name === 'unit_price'),
      true,
    )

    database.prepare(`
      INSERT INTO package_templates (id, name, system_type, is_active)
      VALUES ('incomplete-demo-off-grid', 'Incomplete demo off-grid', 'OFF_GRID', 0)
    `).run()
    database.prepare(`
      INSERT INTO package_template_items (id, template_id, component_code, description)
      VALUES ('incomplete-inverter', 'incomplete-demo-off-grid', 'INVERTER', 'Configurable item')
    `).run()
    assert.throws(
      () => database.prepare(`
        UPDATE package_templates SET is_active = 1 WHERE id = 'incomplete-demo-off-grid'
      `).run(),
      /required BOM components/,
    )

    assert.throws(() => database.prepare(`
      UPDATE quotations SET status = 'RELEASED' WHERE id = 'demo-quote-pending'
    `).run(), /survey is approved/)
    assert.equal(
      database.prepare('SELECT status FROM quotations WHERE id = ?').get('demo-quote-pending').status,
      'DRAFT',
    )

    const leadId = database.prepare('SELECT id FROM leads WHERE customer_id = ?')
      .get('demo-customer-factory-pending').id
    database.prepare(`
      INSERT INTO surveys (
        id, survey_number, lead_id, status
      ) VALUES ('payment-gate-survey', 'PAYMENT-GATE-SURVEY', ?, 'PENDING_APPROVAL')
    `).run(leadId)
    database.prepare(`
      INSERT INTO survey_approvals (id, survey_id, decision)
      VALUES ('payment-gate-approval', 'payment-gate-survey', 'APPROVED')
    `).run()
    database.prepare(`
      INSERT INTO quotations (id, quote_number, lead_id, survey_id, status)
      VALUES ('payment-gate-quote', 'PAYMENT-GATE-QUOTE', ?, 'payment-gate-survey', 'DRAFT')
    `).run(leadId)
    database.prepare(`
      INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price)
      VALUES ('payment-gate-item', 'payment-gate-quote', 'Synthetic test line', 1, 10)
    `).run()
    database.prepare(`
      UPDATE quotations SET status = 'RELEASED' WHERE id = 'payment-gate-quote'
    `).run()
    database.prepare(`
      INSERT INTO orders (id, order_number, quote_id, required_advance_amount)
      VALUES ('payment-gate-order', 'PAYMENT-GATE-ORDER', 'payment-gate-quote', 3)
    `).run()
    database.prepare(`
      UPDATE orders SET status = 'CONFIRMED' WHERE id = 'payment-gate-order'
    `).run()
    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count FROM dispatches WHERE order_id = 'payment-gate-order'
    `).get().count, 1)
    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count FROM installation_jobs WHERE order_id = 'payment-gate-order'
    `).get().count, 1)
    assert.throws(() => database.prepare(`
      UPDATE installation_jobs
      SET status = 'IN_PROGRESS', started_at = '2026-11-22T00:00:00.000Z'
      WHERE order_id = 'payment-gate-order'
    `).run(), /advance or full payment/)

    database.prepare(`
      INSERT INTO payments (
        id, order_id, payment_type, amount, status, reference, recorded_at
      ) VALUES ('payment-gate-advance', 'payment-gate-order', 'ADVANCE', 3, 'RECORDED',
        'PAYMENT-GATE-REFERENCE', '2026-11-22T00:00:00.000Z')
    `).run()
    database.prepare(`
      UPDATE installation_jobs
      SET status = 'IN_PROGRESS', started_at = '2026-11-22T00:00:00.000Z'
      WHERE order_id = 'payment-gate-order'
    `).run()
  } finally {
    database.close()
  }
})

test('only active administrators can approve surveys and serials must match the service customer', () => {
  const database = seedDatabase()
  try {
    const surveyor = insertUser(database, 'SURVEYOR')
    assert.throws(() => database.prepare(`
      INSERT INTO survey_approvals (id, survey_id, reviewer_user_id, decision)
      VALUES ('unauthorized-survey-approval', 'demo-survey-pending', ?, 'APPROVED')
    `).run(surveyor), /Only an active administrator/)

    const admin = insertUser(database, 'ADMIN')
    database.prepare(`
      INSERT INTO survey_approvals (id, survey_id, reviewer_user_id, decision)
      VALUES ('authorized-survey-approval', 'demo-survey-pending', ?, 'APPROVED')
    `).run(admin)
    assert.equal(database.prepare(`
      SELECT status FROM surveys WHERE id = 'demo-survey-pending'
    `).get().status, 'APPROVED')

    database.prepare(`
      INSERT INTO service_tickets (id, ticket_number, customer_id, subject)
      VALUES ('wrong-customer-ticket', 'WRONG-CUSTOMER-TICKET', 'demo-customer-factory-pending', 'Synthetic test')
    `).run()
    assert.throws(() => database.prepare(`
      INSERT INTO service_ticket_items (id, ticket_id, product_serial_id)
      VALUES ('wrong-customer-serial', 'wrong-customer-ticket', 'demo-serial-inverter-1')
    `).run(), /serial must belong to its customer/)
  } finally {
    database.close()
  }
})

test('warranties use delivery completion and the specified product durations only', () => {
  const database = seedDatabase()
  try {
    const rules = database.prepare(`
      SELECT product_type, duration_years, duration_specified
      FROM warranty_rules ORDER BY product_type
    `).all()
    assert.deepEqual(rules, [
      { product_type: 'BATTERY', duration_years: 2, duration_specified: 1 },
      { product_type: 'CHARGE_CONTROLLER', duration_years: null, duration_specified: 0 },
      { product_type: 'INVERTER', duration_years: 2, duration_specified: 1 },
      { product_type: 'PANEL', duration_years: 20, duration_specified: 1 },
    ])

    const warranties = database.prepare(`
      SELECT product_type, duration_years, starts_on, ends_on, status
      FROM warranty_records ORDER BY product_type
    `).all()
    assert.deepEqual(warranties.map((warranty) => warranty.product_type).sort(), [
      'BATTERY', 'CHARGE_CONTROLLER', 'INVERTER', 'PANEL',
    ])
    for (const warranty of warranties) assert.equal(warranty.starts_on, '2026-11-20')
    assert.equal(warranties.find((item) => item.product_type === 'PANEL').ends_on, '2046-11-20')
    assert.equal(warranties.find((item) => item.product_type === 'INVERTER').ends_on, '2028-11-20')
    assert.equal(warranties.find((item) => item.product_type === 'BATTERY').ends_on, '2028-11-20')
    const controllerWarranty = warranties.find((item) => item.product_type === 'CHARGE_CONTROLLER')
    assert.equal(controllerWarranty.duration_years, null)
    assert.equal(controllerWarranty.ends_on, null)
    assert.equal(controllerWarranty.status, 'UNSPECIFIED')

    const pendingDispatch = 'dispatch-demo-order-ongoing'
    const newSerial = 'delivery-gated-serial'
    database.prepare(`
      INSERT INTO product_serials (id, inventory_item_id, warehouse_id, serial_number)
      VALUES (?, 'demo-item-inverter', 'demo-warehouse-central', 'DELIVERY-GATED-SERIAL-001')
    `).run(newSerial)
    database.prepare(`
      INSERT INTO stock_movements (
        id, warehouse_id, inventory_item_id, serial_id, movement_type, quantity
      ) VALUES ('delivery-gated-receipt', 'demo-warehouse-central', 'demo-item-inverter', ?, 'RECEIPT', 1)
    `).run(newSerial)
    database.prepare(`
      INSERT INTO dispatch_serials (dispatch_id, product_serial_id)
      VALUES (?, ?)
    `).run(pendingDispatch, newSerial)
    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count FROM warranty_records WHERE product_serial_id = ?
    `).get(newSerial).count, 0)
    assert.throws(() => database.prepare(`
      INSERT INTO warranty_records (
        id, product_serial_id, product_type, duration_years, starts_on, ends_on, status
      ) VALUES ('premature-warranty', ?, 'INVERTER', 2, '2026-11-22', '2028-11-22', 'ACTIVE')
    `).run(newSerial), /completed delivery/)

    database.prepare(`
      UPDATE dispatches SET status = 'READY' WHERE id = ?
    `).run(pendingDispatch)
    database.prepare(`
      UPDATE dispatches SET status = 'DISPATCHED', departed_at = '2026-11-22T01:00:00.000Z'
      WHERE id = ?
    `).run(pendingDispatch)
    database.prepare(`
      UPDATE dispatches SET status = 'DELIVERED', completed_at = '2026-11-22T02:00:00.000Z'
      WHERE id = ?
    `).run(pendingDispatch)
    assert.equal(database.prepare(`
      SELECT starts_on FROM warranty_records WHERE product_serial_id = ?
    `).get(newSerial).starts_on, '2026-11-22')

    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count
      FROM v_customer_equipment_serials
      WHERE customer_id = 'demo-customer-home-complete'
    `).get().count, 4)
  } finally {
    database.close()
  }
})

test('service-ticket closure requires the matching customer confirmation', () => {
  const database = seedDatabase()
  try {
    database.prepare(`
      INSERT INTO service_resolutions (
        id, ticket_id, product_serial_id, resolution_type, warranty_coverage,
        parts_charge, labour_charge, resolved_at
      ) VALUES (
        'covered-service-resolution', 'demo-service-ticket-open',
        'demo-serial-inverter-1', 'REPAIR', 'COVERED', 0, 0,
        '2026-11-21T00:00:00.000Z'
      )
    `).run()
    assert.throws(() => database.prepare(`
      INSERT INTO service_resolutions (
        id, ticket_id, product_serial_id, resolution_type, warranty_coverage,
        parts_charge, labour_charge, resolved_at
      ) VALUES (
        'unspecified-controller-resolution', 'demo-service-ticket-open',
        'demo-serial-controller-1', 'REPAIR', 'COVERED', 0, 0,
        '2026-11-21T00:00:00.000Z'
      )
    `).run(), /active in-term warranty/)
    assert.throws(() => database.prepare(`
      INSERT INTO service_resolutions (
        id, ticket_id, product_serial_id, resolution_type, warranty_coverage,
        parts_charge, labour_charge, resolved_at
      ) VALUES (
        'unrelated-service-resolution', 'demo-service-ticket-open',
        'demo-serial-battery-1', 'REPAIR', 'NOT_COVERED', 1, 1,
        '2026-11-21T00:00:00.000Z'
      )
    `).run(), /serial must be attached to its ticket/)

    assert.throws(() => database.prepare(`
      UPDATE service_tickets SET status = 'CLOSED', closed_at = ?
      WHERE id = 'demo-service-ticket-open'
    `).run('2026-11-22T00:00:00.000Z'), /Customer confirmation/)

    database.prepare(`
      INSERT INTO customer_service_confirmations (
        id, ticket_id, customer_id, confirmed, confirmed_at
      ) VALUES (
        'demo-service-confirmation', 'demo-service-ticket-open',
        'demo-customer-home-complete', 1, '2026-11-22T00:00:00.000Z'
      )
    `).run()
    database.prepare(`
      UPDATE service_tickets SET status = 'CLOSED', closed_at = ?
      WHERE id = 'demo-service-ticket-open'
    `).run('2026-11-22T00:00:00.000Z')
    assert.equal(database.prepare(`
      SELECT status FROM service_tickets WHERE id = 'demo-service-ticket-open'
    `).get().status, 'CLOSED')
  } finally {
    database.close()
  }
})

test('managed file storage rejects traversal and writes outside the database as files', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solarflow-managed-files-'))
  try {
    assert.equal(
      resolveManagedFilePath(directory, 'surveys/demo-photo.jpg'),
      path.join(directory, 'surveys', 'demo-photo.jpg'),
    )
    assert.throws(() => resolveManagedFilePath(directory, '../outside.txt'), /normalized relative path/)
    assert.throws(() => resolveManagedFilePath(directory, 'surveys\\outside.txt'), /normalized relative path/)
    assert.equal(await writeManagedFile(directory, 'surveys/demo-photo.jpg', Buffer.from('synthetic image metadata test')), 'surveys/demo-photo.jpg')
    assert.equal(
      fs.readFileSync(path.join(directory, 'surveys', 'demo-photo.jpg'), 'utf8'),
      'synthetic image metadata test',
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
