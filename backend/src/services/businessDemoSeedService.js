const BATCH_ID = 'sunpower-business-demo-v1'
const DEMO_DATE = '2026-11-20T10:00:00.000Z'
const WAREHOUSE_ID = 'demo-warehouse-central'

const CUSTOMERS = [
  {
    id: 'demo-customer-home-complete',
    fullName: 'Demo Customer One',
    email: 'customer.one@example.test',
    phone: '0000000001',
    address: '1 Example Lane, Demo City',
    category: 'Home',
    requirement: 'Off-Grid System',
    capacity: 3,
    leadStatus: 'Won',
    notes: 'Synthetic completed-project journey.',
  },
  {
    id: 'demo-customer-home-ongoing',
    fullName: 'Demo Customer Two',
    email: 'customer.two@example.test',
    phone: '0000000002',
    address: '2 Example Lane, Demo City',
    category: 'Home',
    requirement: 'On-Grid System',
    capacity: 2,
    leadStatus: 'Qualified',
    notes: 'Synthetic active installation journey.',
  },
  {
    id: 'demo-customer-factory-pending',
    fullName: 'Demo Factory Customer',
    email: 'factory@example.test',
    phone: '0000000003',
    address: '3 Example Industrial Road, Demo City',
    category: 'Small Factory',
    requirement: 'On-Grid System',
    capacity: 5,
    leadStatus: 'Survey Scheduled',
    notes: 'Synthetic pending-survey journey.',
  },
]

const COMPONENTS = [
  ['PANELS', 'Solar panels', 'panel'],
  ['CONNECTORS', 'Panel connectors', 'unit'],
  ['WIRES', 'Solar wiring', 'meter'],
  ['INVERTER', 'Inverter', 'unit'],
  ['WIRING_BOXES', 'Wiring boxes', 'unit'],
  ['CHARGE_CONTROLLER', 'Battery charge controller', 'unit'],
  ['SAFETY_EARTHING', 'Safety earthing', 'set'],
  ['METAL_STANDS', 'Metal stands', 'set'],
  ['LARGE_BATTERY', 'Large battery bank', 'unit'],
  ['SWITCHES', 'Switches', 'unit'],
  ['SAFETY_PARTS', 'Configurable safety parts', 'set'],
  ['INSTALLATION_SERVICE', 'Fitting and testing service', 'service'],
]

const PACKAGE_TEMPLATES = [
  {
    id: 'demo-package-solar-panel-set',
    name: 'Demo Solar Panel Set',
    type: 'SOLAR_PANEL_SET',
    components: ['PANELS', 'CONNECTORS', 'WIRES'],
  },
  {
    id: 'demo-package-on-grid',
    name: 'Demo On-Grid System',
    type: 'ON_GRID',
    components: [
      'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS',
      'SAFETY_EARTHING', 'METAL_STANDS', 'WIRES', 'SWITCHES', 'SAFETY_PARTS',
    ],
  },
  {
    id: 'demo-package-off-grid',
    name: 'Demo Off-Grid System',
    type: 'OFF_GRID',
    components: [
      'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS',
      'SAFETY_EARTHING', 'METAL_STANDS', 'LARGE_BATTERY',
      'WIRES', 'SWITCHES', 'SAFETY_PARTS',
    ],
  },
  {
    id: 'demo-package-installation',
    name: 'Demo Installation Service',
    type: 'INSTALLATION_SERVICE',
    components: ['INSTALLATION_SERVICE'],
  },
]

const INVENTORY = [
  ['demo-item-panels', 'DEMO-PANELS', 'Demo solar panels', 'PANEL', 0],
  ['demo-item-connectors', 'DEMO-CONNECTORS', 'Demo panel connectors', 'CONNECTOR', 0],
  ['demo-item-wires', 'DEMO-WIRES', 'Demo solar wiring', 'WIRE', 0],
  ['demo-item-inverter', 'DEMO-INVERTER', 'Demo inverter', 'INVERTER', 1],
  ['demo-item-wiring-boxes', 'DEMO-BOXES', 'Demo wiring boxes', 'WIRING_BOXES', 0],
  ['demo-item-charge-controller', 'DEMO-CONTROLLER', 'Demo charge controller', 'CHARGE_CONTROLLER', 1],
  ['demo-item-safety-earthing', 'DEMO-EARTHING', 'Demo safety earthing', 'SAFETY_EARTHING', 0],
  ['demo-item-metal-stands', 'DEMO-STANDS', 'Demo metal stands', 'METAL_STAND', 0],
  ['demo-item-battery', 'DEMO-BATTERY', 'Demo large battery', 'BATTERY', 1],
  ['demo-item-switches', 'DEMO-SWITCHES', 'Demo switches', 'SWITCH', 0],
]

const SERIALS = [
  ['demo-serial-panel-1', 'demo-item-panels', 'DEMO-PANEL-SERIAL-001'],
  ['demo-serial-inverter-1', 'demo-item-inverter', 'DEMO-INVERTER-SERIAL-001'],
  ['demo-serial-battery-1', 'demo-item-battery', 'DEMO-BATTERY-SERIAL-001'],
  ['demo-serial-controller-1', 'demo-item-charge-controller', 'DEMO-CONTROLLER-SERIAL-001'],
]

function registerDemoRecord(database, entityType, entityId) {
  database.prepare(`
    INSERT OR IGNORE INTO demo_seed_records (batch_id, entity_type, entity_id)
    VALUES (?, ?, ?)
  `).run(BATCH_ID, entityType, entityId)
}

function insertDemo(database, entityType, entityId, sql, values) {
  database.prepare(sql).run(...values)
  registerDemoRecord(database, entityType, entityId)
}

function ensureCustomerAndLead(database, customer) {
  insertDemo(database, 'customers', customer.id, `
    INSERT OR IGNORE INTO customers (
      id, full_name, email, phone, address, category, solar_requirement,
      capacity_kw, lead_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    customer.id,
    customer.fullName,
    customer.email,
    customer.phone,
    customer.address,
    customer.category,
    customer.requirement,
    customer.capacity,
    customer.leadStatus,
    customer.notes,
  ])
  const lead = database.prepare('SELECT id FROM leads WHERE customer_id = ?').get(customer.id)
  if (!lead) throw new Error(`Demo customer ${customer.id} did not receive a lead record`)
  database.prepare(`
    UPDATE leads SET status = ?, source = 'DEMO', notes = ?
    WHERE id = ?
  `).run(customer.leadStatus, customer.notes, lead.id)
  registerDemoRecord(database, 'leads', lead.id)
  return lead.id
}

function insertQuotation(database, { id, number, leadId, surveyId, packageId, status, description }) {
  insertDemo(database, 'quotations', id, `
    INSERT OR IGNORE INTO quotations (
      id, quote_number, lead_id, survey_id, package_template_id, status, issued_at, terms
    ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?)
  `, [
    id,
    number,
    leadId,
    surveyId,
    packageId,
    DEMO_DATE,
    'SYNTHETIC demonstration only; not an official price or offer.',
  ])

  const hasItem = database.prepare('SELECT 1 FROM quotation_items WHERE id = ?').get(`${id}-item`)
  if (!hasItem) {
    insertDemo(database, 'quotation_items', `${id}-item`, `
      INSERT INTO quotation_items (
        id, quotation_id, description, quantity, unit, unit_price, sort_order
      ) VALUES (?, ?, ?, 1, 'package', 1.00, 1)
    `, [`${id}-item`, id, description])
  } else {
    registerDemoRecord(database, 'quotation_items', `${id}-item`)
  }

  if (status === 'RELEASED') {
    database.prepare(`
      UPDATE quotations SET status = 'RELEASED', issued_at = ?
      WHERE id = ? AND status = 'DRAFT'
    `).run(DEMO_DATE, id)
  }
  return id
}

function insertOrder(database, { id, number, quoteId, requiredAdvance, status }) {
  insertDemo(database, 'orders', id, `
    INSERT OR IGNORE INTO orders (
      id, order_number, quote_id, required_advance_amount, status, confirmed_at
    ) VALUES (?, ?, ?, ?, 'DRAFT', ?)
  `, [id, number, quoteId, requiredAdvance, DEMO_DATE])
  if (status === 'CONFIRMED') {
    database.prepare(`
      UPDATE orders SET status = 'CONFIRMED', confirmed_at = ?
      WHERE id = ? AND status = 'DRAFT'
    `).run(DEMO_DATE, id)
  }
  registerDemoRecord(database, 'dispatches', `dispatch-${id}`)
  registerDemoRecord(database, 'installation_jobs', `installation-${id}`)
}

export function seedDemoBusiness(database) {
  return database.transaction(() => {
    database.prepare(`
      INSERT OR IGNORE INTO demo_seed_batches (id, name, description)
      VALUES (?, ?, ?)
    `).run(
      BATCH_ID,
      'SunPower synthetic business workflow examples',
      'Fictional example.test customer records and explicitly illustrative workflow amounts.',
    )

    for (const customer of CUSTOMERS) ensureCustomerAndLead(database, customer)

    database.prepare(`
      INSERT OR IGNORE INTO warehouses (id, code, name, address)
      VALUES (?, 'DEMO-CENTRAL', 'Demo Central Warehouse', 'Example Warehouse Road, Demo City')
    `).run(WAREHOUSE_ID)
    registerDemoRecord(database, 'warehouses', WAREHOUSE_ID)

    const insertInventory = database.prepare(`
      INSERT OR IGNORE INTO inventory_items (id, sku, name, product_type, tracks_serial)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const [id, sku, name, productType, tracksSerial] of INVENTORY) {
      insertInventory.run(id, sku, name, productType, tracksSerial)
      registerDemoRecord(database, 'inventory_items', id)
    }

    const componentByCode = new Map(COMPONENTS.map(([code, description, unit]) => [code, { description, unit }]))
    const insertTemplate = database.prepare(`
      INSERT OR IGNORE INTO package_templates (id, name, system_type, description, is_active)
      VALUES (?, ?, ?, ?, 0)
    `)
    const insertTemplateItem = database.prepare(`
      INSERT OR IGNORE INTO package_template_items (
        id, template_id, component_code, description, quantity, unit, sort_order
      ) VALUES (?, ?, ?, ?, NULL, ?, ?)
    `)
    for (const template of PACKAGE_TEMPLATES) {
      insertTemplate.run(
        template.id,
        template.name,
        template.type,
        'SYNTHETIC configurable BOM; quantities and package prices are not specified.',
      )
      registerDemoRecord(database, 'package_templates', template.id)
      template.components.forEach((code, index) => {
        const component = componentByCode.get(code)
        const id = `${template.id}-item-${code.toLowerCase()}`
        insertTemplateItem.run(id, template.id, code, component.description, component.unit, index + 1)
        registerDemoRecord(database, 'package_template_items', id)
      })
      database.prepare('UPDATE package_templates SET is_active = 1 WHERE id = ? AND is_active = 0')
        .run(template.id)
    }

    const insertSurvey = database.prepare(`
      INSERT OR IGNORE INTO surveys (
        id, survey_number, lead_id, shadow_free_roof_area_sqm,
        monthly_electricity_bill, grid_suitability, roof_direction,
        roof_tilt_degrees, cable_distance_meters, notes, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const customerLeadIds = new Map(CUSTOMERS.map((customer) => [
      customer.id,
      database.prepare('SELECT id FROM leads WHERE customer_id = ?').get(customer.id).id,
    ]))
    const surveyRows = [
      ['demo-survey-complete', 'DEMO-SURVEY-001', customerLeadIds.get(CUSTOMERS[0].id), 86, 2300, 'SUITABLE', 'S', 18, 14, 'SYNTHETIC approved example.', 'PENDING_APPROVAL'],
      ['demo-survey-ongoing', 'DEMO-SURVEY-002', customerLeadIds.get(CUSTOMERS[1].id), 72, 1800, 'SUITABLE', 'SW', 15, 11, 'SYNTHETIC approved example.', 'PENDING_APPROVAL'],
      ['demo-survey-pending', 'DEMO-SURVEY-003', customerLeadIds.get(CUSTOMERS[2].id), 120, 4200, 'UNKNOWN', 'E', 10, 22, 'SYNTHETIC pending approval example.', 'PENDING_APPROVAL'],
    ]
    for (const survey of surveyRows) {
      insertSurvey.run(...survey.slice(0, 10), survey[10], DEMO_DATE)
      registerDemoRecord(database, 'surveys', survey[0])
    }

    const insertApproval = database.prepare(`
      INSERT OR IGNORE INTO survey_approvals (id, survey_id, decision, notes, decided_at)
      VALUES (?, ?, 'APPROVED', ?, ?)
    `)
    for (const [approvalId, surveyId] of [
      ['demo-survey-approval-1', 'demo-survey-complete'],
      ['demo-survey-approval-2', 'demo-survey-ongoing'],
    ]) {
      insertApproval.run(approvalId, surveyId, 'SYNTHETIC approval example.', DEMO_DATE)
      registerDemoRecord(database, 'survey_approvals', approvalId)
    }

    const quoteComplete = insertQuotation(database, {
      id: 'demo-quote-complete',
      number: 'DEMO-QUOTE-001',
      leadId: customerLeadIds.get(CUSTOMERS[0].id),
      surveyId: 'demo-survey-complete',
      packageId: 'demo-package-off-grid',
      status: 'RELEASED',
      description: 'SYNTHETIC off-grid package placeholder; amount is illustrative only.',
    })
    const quoteOngoing = insertQuotation(database, {
      id: 'demo-quote-ongoing',
      number: 'DEMO-QUOTE-002',
      leadId: customerLeadIds.get(CUSTOMERS[1].id),
      surveyId: 'demo-survey-ongoing',
      packageId: 'demo-package-on-grid',
      status: 'RELEASED',
      description: 'SYNTHETIC on-grid package placeholder; amount is illustrative only.',
    })
    insertQuotation(database, {
      id: 'demo-quote-pending',
      number: 'DEMO-QUOTE-003',
      leadId: customerLeadIds.get(CUSTOMERS[2].id),
      surveyId: 'demo-survey-pending',
      packageId: 'demo-package-on-grid',
      status: 'DRAFT',
      description: 'SYNTHETIC draft placeholder pending survey approval.',
    })

    insertOrder(database, {
      id: 'demo-order-complete',
      number: 'DEMO-ORDER-001',
      quoteId: quoteComplete,
      requiredAdvance: null,
      status: 'CONFIRMED',
    })
    insertOrder(database, {
      id: 'demo-order-ongoing',
      number: 'DEMO-ORDER-002',
      quoteId: quoteOngoing,
      requiredAdvance: 0.25,
      status: 'CONFIRMED',
    })

    const insertPayment = database.prepare(`
      INSERT OR IGNORE INTO payments (
        id, order_id, payment_type, amount, method, status, reference, recorded_at
      ) VALUES (?, ?, ?, ?, 'OTHER', 'RECORDED', ?, ?)
    `)
    insertPayment.run('demo-payment-full', 'demo-order-complete', 'FULL', 1, 'DEMO-PAYMENT-FULL', DEMO_DATE)
    insertPayment.run('demo-payment-advance', 'demo-order-ongoing', 'ADVANCE', 0.25, 'DEMO-PAYMENT-ADVANCE', DEMO_DATE)
    registerDemoRecord(database, 'payments', 'demo-payment-full')
    registerDemoRecord(database, 'payments', 'demo-payment-advance')

    const insertJobStatus = database.prepare(`
      UPDATE installation_jobs SET status = 'IN_PROGRESS', started_at = ?, scheduled_start = ?
      WHERE order_id = ? AND status = 'SCHEDULED'
    `)
    insertJobStatus.run('2026-11-01T09:00:00.000Z', '2026-11-01T09:00:00.000Z', 'demo-order-complete')
    database.prepare(`
      UPDATE installation_jobs SET status = 'COMPLETED', completed_at = ?
      WHERE order_id = ? AND status = 'IN_PROGRESS'
    `).run('2026-11-02T16:00:00.000Z', 'demo-order-complete')
    insertJobStatus.run('2026-11-21T09:00:00.000Z', '2026-11-21T09:00:00.000Z', 'demo-order-ongoing')

    database.prepare(`
      UPDATE dispatches SET warehouse_id = ? WHERE order_id IN (?, ?)
    `).run(WAREHOUSE_ID, 'demo-order-complete', 'demo-order-ongoing')

    const insertSerial = database.prepare(`
      INSERT OR IGNORE INTO product_serials (id, inventory_item_id, warehouse_id, serial_number)
      VALUES (?, ?, ?, ?)
    `)
    for (const [id, itemId, serialNumber] of SERIALS) {
      insertSerial.run(id, itemId, WAREHOUSE_ID, serialNumber)
      registerDemoRecord(database, 'product_serials', id)
    }

    const insertMovement = database.prepare(`
      INSERT OR IGNORE INTO stock_movements (
        id, warehouse_id, inventory_item_id, serial_id, movement_type,
        quantity, reference_type, reference_id, note
      ) VALUES (?, ?, ?, ?, 'RECEIPT', ?, 'DEMO_SEED', ?, 'SYNTHETIC opening stock')
    `)
    for (const [id, itemId, serialNumber] of SERIALS) {
      insertMovement.run(
        `demo-receipt-${id}`,
        WAREHOUSE_ID,
        itemId,
        id,
        1,
        BATCH_ID,
      )
      registerDemoRecord(database, 'stock_movements', `demo-receipt-${id}`)
    }
    for (const [movementId, itemId, quantity] of [
      ['demo-receipt-panels-bulk', 'demo-item-panels', 12],
      ['demo-receipt-wires-bulk', 'demo-item-wires', 80],
    ]) {
      database.prepare(`
        INSERT OR IGNORE INTO stock_movements (
          id, warehouse_id, inventory_item_id, movement_type, quantity,
          reference_type, reference_id, note
        ) VALUES (?, ?, ?, 'RECEIPT', ?, 'DEMO_SEED', ?, 'SYNTHETIC opening stock')
      `).run(movementId, WAREHOUSE_ID, itemId, quantity, BATCH_ID)
      registerDemoRecord(database, 'stock_movements', movementId)
    }

    const completedDispatch = 'dispatch-demo-order-complete'
    const insertDispatchSerial = database.prepare(`
      INSERT OR IGNORE INTO dispatch_serials (dispatch_id, product_serial_id)
      VALUES (?, ?)
    `)
    for (const [serialId] of SERIALS) {
      const exists = database.prepare(`
        SELECT 1 FROM dispatch_serials WHERE dispatch_id = ? AND product_serial_id = ?
      `).get(completedDispatch, serialId)
      if (!exists) insertDispatchSerial.run(completedDispatch, serialId)
      registerDemoRecord(database, 'dispatch_serials', `${completedDispatch}:${serialId}`)
    }
    database.prepare(`
      UPDATE dispatches SET status = 'READY' WHERE id = ? AND status = 'PICKING'
    `).run(completedDispatch)
    database.prepare(`
      UPDATE dispatches SET status = 'DISPATCHED', departed_at = ?
      WHERE id = ? AND status = 'READY'
    `).run(DEMO_DATE, completedDispatch)
    database.prepare(`
      UPDATE dispatches SET status = 'DELIVERED', completed_at = ?
      WHERE id = ? AND status = 'DISPATCHED'
    `).run(DEMO_DATE, completedDispatch)

    for (const type of ['customers', 'leads', 'surveys', 'quotations', 'orders', 'dispatches', 'installation_jobs']) {
      const ids = database.prepare(`
        SELECT entity_id FROM demo_seed_records
        WHERE batch_id = ? AND entity_type = ?
      `).all(BATCH_ID, type)
      for (const { entity_id: id } of ids) registerDemoRecord(database, type, id)
    }

    const invoice = 'demo-invoice-complete'
    insertDemo(database, 'invoices', invoice, `
      INSERT OR IGNORE INTO invoices (id, invoice_number, order_id, status, issued_at)
      VALUES (?, 'DEMO-INVOICE-001', 'demo-order-complete', 'ISSUED', ?)
    `, [invoice, DEMO_DATE])
    insertDemo(database, 'invoice_items', `${invoice}-item`, `
      INSERT OR IGNORE INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, sort_order
      ) VALUES (?, ?, 'SYNTHETIC demo invoice line; not an official price.', 1, 1.00, 1)
    `, [`${invoice}-item`, invoice])

    const purchase = 'demo-stock-purchase'
    insertDemo(database, 'stock_purchases', purchase, `
      INSERT OR IGNORE INTO stock_purchases (
        id, purchase_number, warehouse_id, order_id, supplier_name, status, purchased_at, received_at
      ) VALUES (?, 'DEMO-PURCHASE-001', ?, 'demo-order-ongoing', 'Fictional Demo Supplier', 'RECEIVED', ?, ?)
    `, [purchase, WAREHOUSE_ID, DEMO_DATE, DEMO_DATE])
    insertDemo(database, 'stock_purchase_items', `${purchase}-item`, `
      INSERT OR IGNORE INTO stock_purchase_items (
        id, purchase_id, inventory_item_id, quantity, unit_cost, sort_order
      ) VALUES (?, ?, 'demo-item-battery', 1, 0.10, 1)
    `, [`${purchase}-item`, purchase])

    const expense = 'demo-expense-ongoing'
    insertDemo(database, 'expenses', expense, `
      INSERT OR IGNORE INTO expenses (
        id, order_id, expense_type, description, amount, incurred_at
      ) VALUES (?, 'demo-order-ongoing', 'TRAVEL', 'SYNTHETIC travel expense; illustrative only.', 0.05, ?)
    `, [expense, DEMO_DATE])

    const signoff = 'demo-customer-signoff'
    insertDemo(database, 'customer_signoffs', signoff, `
      INSERT OR IGNORE INTO customer_signoffs (
        id, job_id, customer_id, customer_name, signed_at, notes
      ) VALUES (?, 'installation-demo-order-complete', ?, ?, ?, 'SYNTHETIC sign-off record; no signature image stored.')
    `, [signoff, CUSTOMERS[0].id, CUSTOMERS[0].fullName, DEMO_DATE])

    const ticket = 'demo-service-ticket-open'
    insertDemo(database, 'service_tickets', ticket, `
      INSERT OR IGNORE INTO service_tickets (
        id, ticket_number, customer_id, order_id, subject, description, status
      ) VALUES (?, 'DEMO-TICKET-001', ?, 'demo-order-complete', 'Synthetic equipment support request',
        'Fictional open-ticket example for serial lookup.', 'OPEN')
    `, [ticket, CUSTOMERS[0].id])
    insertDemo(database, 'service_ticket_items', `${ticket}-inverter`, `
      INSERT OR IGNORE INTO service_ticket_items (id, ticket_id, product_serial_id, symptom)
      VALUES (?, ?, 'demo-serial-inverter-1', 'Synthetic example symptom.')
    `, [`${ticket}-inverter`, ticket])

    const subsidy = 'demo-subsidy-case'
    insertDemo(database, 'subsidy_cases', subsidy, `
      INSERT OR IGNORE INTO subsidy_cases (
        id, case_number, customer_id, program_name, status, notes
      ) VALUES (?, 'DEMO-SUBSIDY-001', ?, 'Synthetic placeholder only', 'SUBMITTED',
        'No government amount or eligibility is represented.')
    `, [subsidy, CUSTOMERS[0].id])

    const salesUser = database.prepare(`
      SELECT id FROM users WHERE role = 'SALES' AND is_active = 1 ORDER BY created_at, id LIMIT 1
    `).get()
    if (salesUser) {
      const followUp = 'demo-follow-up-ongoing'
      insertDemo(database, 'follow_ups', followUp, `
        INSERT OR IGNORE INTO follow_ups (
          id, lead_id, assigned_to, due_at, note
        ) VALUES (?, ?, ?, '2026-11-25T10:00:00.000Z', 'SYNTHETIC follow-up reminder.')
      `, [followUp, customerLeadIds.get(CUSTOMERS[1].id), salesUser.id])
    }

    const technician = database.prepare(`
      SELECT id FROM users WHERE role = 'TECHNICIAN' AND is_active = 1 ORDER BY created_at, id LIMIT 1
    `).get()
    if (technician) {
      const assignment = 'demo-install-assignment'
      insertDemo(database, 'installation_assignments', assignment, `
        INSERT OR IGNORE INTO installation_assignments (job_id, technician_user_id)
        VALUES ('installation-demo-order-complete', ?)
      `, [technician.id])
      const payroll = 'demo-technician-payroll'
      insertDemo(database, 'technician_payroll_entries', payroll, `
        INSERT OR IGNORE INTO technician_payroll_entries (
          id, job_id, technician_user_id, hours, hourly_rate, amount, paid_at, notes
        ) VALUES (?, 'installation-demo-order-complete', ?, 1, NULL, NULL, NULL,
          'SYNTHETIC recorded hours; compensation rate unspecified.')
      `, [payroll, technician.id])
    }

    return {
      batchId: BATCH_ID,
      customerCount: database.prepare(`
        SELECT COUNT(*) AS count FROM demo_seed_records
        WHERE batch_id = ? AND entity_type = 'customers'
      `).get(BATCH_ID).count,
      recordCount: database.prepare(`
        SELECT COUNT(*) AS count FROM demo_seed_records WHERE batch_id = ?
      `).get(BATCH_ID).count,
    }
  })()
}
