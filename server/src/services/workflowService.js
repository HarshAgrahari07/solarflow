import { randomUUID } from 'node:crypto'
import { HttpError } from '../errors.js'

const ORDER_SELECT = `
  SELECT order_record.*,
         quote.quote_number,
         quote.status AS quotation_status,
         quote.id AS quotation_id,
         customer.id AS customer_id,
         customer.full_name AS customer_name,
         customer.linked_user_id,
         lead.assigned_to AS sales_owner_id,
         totals.total_amount,
         dispatch.id AS dispatch_id,
         dispatch.dispatch_number,
         dispatch.status AS dispatch_status,
         installation.id AS installation_id,
         installation.job_number,
         installation.status AS installation_status,
         coalesce((SELECT sum(payment.amount) FROM payments payment
                   WHERE payment.order_id = order_record.id AND payment.status = 'RECORDED'), 0) AS paid_amount
  FROM orders order_record
  JOIN quotations quote ON quote.id = order_record.quote_id
  JOIN leads lead ON lead.id = quote.lead_id
  JOIN customers customer ON customer.id = lead.customer_id
  LEFT JOIN v_quotation_totals totals ON totals.quotation_id = quote.id
  LEFT JOIN dispatches dispatch ON dispatch.order_id = order_record.id
  LEFT JOIN installation_jobs installation ON installation.order_id = order_record.id
`

function audit(database, actor, action, entityType, entityId, details = {}) {
  database.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), actor.id, action, entityType, entityId, JSON.stringify(details))
}

function orderById(database, orderId) {
  return database.prepare(`${ORDER_SELECT} WHERE order_record.id = ?`).get(orderId)
}

function assertOrderAccess(order, actor) {
  if (actor.role === 'ADMIN' || actor.role === 'FINANCE' || actor.role === 'WAREHOUSE') return
  if (actor.role === 'SALES' && (!order.sales_owner_id || order.sales_owner_id === actor.id)) return
  if (actor.role === 'CUSTOMER' && order.linked_user_id === actor.id) return
  throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
}

function scopedOrder(database, orderId, actor) {
  const order = orderById(database, orderId)
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (actor.role === 'TECHNICIAN') {
    const assignment = database.prepare(`
      SELECT 1 FROM installation_assignments
      WHERE job_id = ? AND technician_user_id = ?
    `).get(order.installation_id, actor.id)
    if (!assignment) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
  } else {
    assertOrderAccess(order, actor)
  }
  return order
}

function orderDto(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    quoteId: order.quote_id,
    quoteNumber: order.quote_number,
    quoteStatus: order.quotation_status,
    customerId: order.customer_id,
    customerName: order.customer_name,
    status: order.status,
    requiredAdvanceAmount: order.required_advance_amount,
    totalAmount: order.total_amount,
    paidAmount: order.paid_amount,
    outstandingAmount: order.total_amount === null
      ? null
      : Math.max(0, order.total_amount - order.paid_amount),
    confirmedAt: order.confirmed_at,
    dispatch: order.dispatch_id ? {
      id: order.dispatch_id,
      number: order.dispatch_number,
      status: order.dispatch_status,
    } : null,
    installation: order.installation_id ? {
      id: order.installation_id,
      number: order.job_number,
      status: order.installation_status,
    } : null,
    createdAt: order.created_at,
  }
}

function assertRole(actor, roles, message = 'You do not have permission to perform this operation') {
  if (!roles.includes(actor.role)) throw new HttpError(403, 'FORBIDDEN', message)
}

function findQuotation(database, quoteId) {
  return database.prepare(`
    SELECT quote.id, quote.quote_number, quote.status, quote.lead_id,
           customer.id AS customer_id, customer.linked_user_id,
           lead.assigned_to AS sales_owner_id
    FROM quotations quote
    JOIN leads lead ON lead.id = quote.lead_id
    JOIN customers customer ON customer.id = lead.customer_id
    WHERE quote.id = ?
  `).get(quoteId)
}

function assertQuotationAccess(quote, actor) {
  if (actor.role === 'ADMIN') return
  if (actor.role === 'SALES' && (!quote.sales_owner_id || quote.sales_owner_id === actor.id)) return
  if (actor.role === 'CUSTOMER' && quote.linked_user_id === actor.id) return
  throw new HttpError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found')
}

export function listOrders(database, actor) {
  const orders = database.prepare(`
    ${ORDER_SELECT}
    ORDER BY order_record.created_at DESC
  `).all()
  return orders.filter((order) => {
    if (actor.role === 'TECHNICIAN') {
      return Boolean(database.prepare(`
        SELECT 1 FROM installation_assignments
        WHERE job_id = ? AND technician_user_id = ?
      `).get(order.installation_id, actor.id))
    }
    if (actor.role === 'CUSTOMER') return order.linked_user_id === actor.id
    if (actor.role === 'SALES') return !order.sales_owner_id || order.sales_owner_id === actor.id
    return ['ADMIN', 'FINANCE', 'WAREHOUSE'].includes(actor.role)
  }).map(orderDto)
}

export function getOrder(database, orderId, actor) {
  return orderDto(scopedOrder(database, orderId, actor))
}

export function createOrder(database, fields, actor) {
  assertRole(actor, ['ADMIN', 'SALES'])
  const quote = findQuotation(database, fields.quoteId)
  if (!quote) throw new HttpError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found')
  assertQuotationAccess(quote, actor)
  if (quote.status !== 'ACCEPTED') {
    throw new HttpError(409, 'QUOTATION_NOT_ACCEPTED', 'An accepted quotation is required to create an order')
  }
  const existing = database.prepare('SELECT id FROM orders WHERE quote_id = ?').get(quote.id)
  if (existing) return getOrder(database, existing.id, actor)
  const id = randomUUID()
  const number = `SO-${randomUUID().slice(0, 8).toUpperCase()}`
  database.prepare(`
    INSERT INTO orders (id, order_number, quote_id, required_advance_amount)
    VALUES (?, ?, ?, ?)
  `).run(id, number, quote.id, fields.requiredAdvanceAmount ?? null)
  audit(database, actor, 'ORDER_CREATED', 'orders', id, { quoteId: quote.id })
  return getOrder(database, id, actor)
}

const INSTALLATION_CHECKLIST = [
  ['SITE_SAFETY', 'Confirm site safety and equipment isolation'],
  ['MOUNTING', 'Inspect panel mounting and structural fixings'],
  ['ELECTRICAL', 'Verify wiring, earthing, and protection'],
  ['COMMISSIONING', 'Complete system commissioning checks'],
]

export function confirmOrder(database, orderId, actor) {
  assertRole(actor, ['ADMIN'])
  const order = scopedOrder(database, orderId, actor)
  if (order.status !== 'DRAFT' || order.quotation_status !== 'ACCEPTED') {
    throw new HttpError(409, 'ORDER_NOT_CONFIRMABLE', 'Only an order for an accepted quotation can be confirmed')
  }
  const itemCount = database.prepare('SELECT count(*) AS count FROM quotation_items WHERE quotation_id = ?')
    .get(order.quote_id).count
  if (!itemCount) throw new HttpError(409, 'ORDER_BOM_REQUIRED', 'Add a quotation BOM before confirming the order')
  const confirm = database.transaction(() => {
    database.prepare(`
      UPDATE orders
      SET status = 'CONFIRMED', confirmed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(orderId)
    const jobId = database.prepare('SELECT id FROM installation_jobs WHERE order_id = ?').get(orderId)?.id
    if (jobId) {
      const insert = database.prepare(`
        INSERT OR IGNORE INTO installation_checklists (id, job_id, check_code, description)
        VALUES (?, ?, ?, ?)
      `)
      for (const [code, description] of INSTALLATION_CHECKLIST) {
        insert.run(randomUUID(), jobId, code, description)
      }
    }
  })
  try {
    confirm()
  } catch (error) {
    throw new HttpError(409, 'ORDER_CONFIRMATION_FAILED', error.message)
  }
  audit(database, actor, 'ORDER_CONFIRMED', 'orders', orderId)
  return getOrder(database, orderId, actor)
}

export function listPayments(database, orderId, actor) {
  scopedOrder(database, orderId, actor)
  return database.prepare(`
    SELECT id, payment_type AS type, amount, method, status, reference, recorded_at AS recordedAt
    FROM payments WHERE order_id = ? ORDER BY created_at, id
  `).all(orderId)
}

export function recordPayment(database, orderId, fields, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  const order = scopedOrder(database, orderId, actor)
  if (!['CONFIRMED', 'COMPLETED'].includes(order.status)) {
    throw new HttpError(409, 'ORDER_NOT_PAYABLE', 'Payments can only be recorded for confirmed orders')
  }
  if (order.total_amount !== null && fields.amount > Math.max(0, order.total_amount - order.paid_amount)) {
    throw new HttpError(409, 'PAYMENT_EXCEEDS_BALANCE', 'Payment cannot exceed the configured quotation balance')
  }
  if (fields.type === 'FULL' && order.total_amount === null) {
    throw new HttpError(409, 'QUOTE_NOT_FULLY_PRICED', 'A full payment requires every quotation item to have a configured price')
  }
  const id = randomUUID()
  const reference = fields.reference?.trim() || `PAY-${randomUUID().slice(0, 8).toUpperCase()}`
  try {
    database.prepare(`
      INSERT INTO payments (
        id, order_id, payment_type, amount, method, status, reference, recorded_at, created_by
      ) VALUES (?, ?, ?, ?, ?, 'RECORDED', ?, ?, ?)
    `).run(
      id,
      orderId,
      fields.type,
      fields.amount,
      fields.method ?? null,
      reference,
      fields.recordedAt || new Date().toISOString(),
      actor.id,
    )
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'PAYMENT_REFERENCE_EXISTS', 'That payment reference has already been recorded')
    }
    if (String(error.message).includes('full payment')) {
      throw new HttpError(409, 'FULL_PAYMENT_INSUFFICIENT', 'Recorded payments do not cover the fully priced quotation')
    }
    throw error
  }
  audit(database, actor, 'PAYMENT_RECORDED', 'payments', id, { orderId, type: fields.type, amount: fields.amount })
  return database.prepare(`
    SELECT id, order_id AS orderId, payment_type AS type, amount, method, status,
           reference, recorded_at AS recordedAt
    FROM payments WHERE id = ?
  `).get(id)
}

export function listInventory(database) {
  return database.prepare(`
    SELECT item.id, item.sku, item.name, item.product_type AS productType,
           item.unit, item.tracks_serial AS tracksSerial,
           item.reorder_level AS reorderLevel,
           warehouse.id AS warehouseId, warehouse.name AS warehouseName,
           coalesce(balance.quantity_on_hand, 0) AS quantityOnHand,
           coalesce(balance.quantity_reserved, 0) AS quantityReserved,
           coalesce(balance.quantity_on_hand - balance.quantity_reserved, 0) AS available
    FROM inventory_items item
    JOIN warehouses warehouse ON warehouse.is_active = 1
    LEFT JOIN stock_balances balance
      ON balance.inventory_item_id = item.id AND balance.warehouse_id = warehouse.id
    WHERE item.is_active = 1
    ORDER BY item.name COLLATE NOCASE, warehouse.name COLLATE NOCASE
  `).all().map((row) => ({ ...row, lowStock: row.available <= row.reorderLevel }))
}

export function receiveStock(database, fields, actor) {
  assertRole(actor, ['ADMIN', 'WAREHOUSE'])
  if (!database.prepare('SELECT 1 FROM warehouses WHERE id = ? AND is_active = 1').get(fields.warehouseId)) {
    throw new HttpError(400, 'INVALID_WAREHOUSE', 'Select an active warehouse')
  }
  const item = database.prepare(`
    SELECT id, product_type, tracks_serial FROM inventory_items WHERE id = ? AND is_active = 1
  `).get(fields.inventoryItemId)
  if (!item) throw new HttpError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found')
  if (item.tracks_serial && (!fields.serialNumber || fields.quantity !== 1)) {
    throw new HttpError(400, 'SERIAL_REQUIRED', 'Serialized products must be received one unique serial at a time')
  }
  if (!item.tracks_serial && fields.serialNumber) {
    throw new HttpError(400, 'SERIAL_NOT_ALLOWED', 'This inventory item is not serial tracked')
  }
  const id = randomUUID()
  const receive = database.transaction(() => {
    let serialId = null
    if (fields.serialNumber) {
      serialId = randomUUID()
      database.prepare(`
        INSERT INTO product_serials (id, inventory_item_id, warehouse_id, serial_number)
        VALUES (?, ?, ?, ?)
      `).run(serialId, item.id, fields.warehouseId, fields.serialNumber.trim())
    }
    database.prepare(`
      INSERT INTO stock_movements (
        id, warehouse_id, inventory_item_id, serial_id, movement_type,
        quantity, reference_type, reference_id, note, created_by
      ) VALUES (?, ?, ?, ?, 'RECEIPT', ?, 'RECEIPT', ?, ?, ?)
    `).run(id, fields.warehouseId, item.id, serialId, fields.quantity, fields.reference || id, fields.note || '', actor.id)
    return serialId
  })
  try {
    const serialId = receive()
    audit(database, actor, 'STOCK_RECEIVED', 'stock_movements', id, { inventoryItemId: item.id, quantity: fields.quantity })
    return { movementId: id, serialId }
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'SERIAL_ALREADY_EXISTS', 'That serial number is already recorded')
    }
    throw error
  }
}

function dispatchRecord(database, dispatchId) {
  const dispatch = database.prepare(`
    SELECT dispatch.*, order_record.id AS linked_order_id
    FROM dispatches dispatch
    JOIN orders order_record ON order_record.id = dispatch.order_id
    WHERE dispatch.id = ?
  `).get(dispatchId)
  if (!dispatch) throw new HttpError(404, 'DISPATCH_NOT_FOUND', 'Dispatch not found')
  return dispatch
}

function quotationLines(database, orderId) {
  return database.prepare(`
    SELECT item.id, item.quantity, item.product_type, item.unit,
           template.component_code
    FROM orders order_record
    JOIN quotation_items item ON item.quotation_id = order_record.quote_id
    LEFT JOIN package_template_items template ON template.id = item.template_item_id
    WHERE order_record.id = ?
    ORDER BY item.sort_order
  `).all(orderId)
}

function reserveDispatchStock(database, dispatch, actor) {
  const previous = database.prepare(`
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'DISPATCH' AND reference_id = ? AND movement_type = 'RESERVE'
    LIMIT 1
  `).get(dispatch.id)
  if (previous) return
  const lines = quotationLines(database, dispatch.order_id)
  if (!lines.length) throw new HttpError(409, 'ORDER_BOM_REQUIRED', 'Order has no inventory BOM to reserve')
  for (const line of lines) {
    if (line.product_type === 'INSTALLATION_SERVICE') continue
    if (!line.product_type) {
      throw new HttpError(409, 'BOM_ITEM_NOT_MAPPED', 'Map every material quotation item to an inventory product before reserving stock')
    }
    const inventory = database.prepare(`
      SELECT item.id, item.tracks_serial,
             coalesce(balance.quantity_on_hand - balance.quantity_reserved, 0) AS available
      FROM inventory_items item
      LEFT JOIN stock_balances balance
        ON balance.inventory_item_id = item.id AND balance.warehouse_id = ?
      WHERE item.product_type = ? AND item.is_active = 1
      ORDER BY available DESC, item.sku
      LIMIT 1
    `).get(dispatch.warehouse_id, line.product_type)
    if (!inventory) throw new HttpError(409, 'STOCK_UNAVAILABLE', `No active stock item matches ${line.product_type}`)
    if (inventory.tracks_serial) {
      const units = Math.ceil(line.quantity)
      const serials = database.prepare(`
        SELECT id FROM product_serials
        WHERE inventory_item_id = ? AND warehouse_id = ? AND status = 'IN_STOCK'
        ORDER BY received_at, serial_number LIMIT ?
      `).all(inventory.id, dispatch.warehouse_id, units)
      if (serials.length < units) {
        throw new HttpError(409, 'STOCK_UNAVAILABLE', `Insufficient serialized ${line.product_type} stock`)
      }
      for (const serial of serials) {
        database.prepare(`
          INSERT INTO stock_movements (
            id, warehouse_id, inventory_item_id, serial_id, movement_type, quantity,
            reference_type, reference_id, note, created_by
          ) VALUES (?, ?, ?, ?, 'RESERVE', 1, 'DISPATCH', ?, 'Order picking reservation', ?)
        `).run(randomUUID(), dispatch.warehouse_id, inventory.id, serial.id, dispatch.id, actor.id)
      }
    } else {
      if (inventory.available < line.quantity) {
        throw new HttpError(409, 'STOCK_UNAVAILABLE', `Insufficient ${line.product_type} stock`)
      }
      database.prepare(`
        INSERT INTO stock_movements (
          id, warehouse_id, inventory_item_id, movement_type, quantity,
          reference_type, reference_id, note, created_by
        ) VALUES (?, ?, ?, 'RESERVE', ?, 'DISPATCH', ?, 'Order picking reservation', ?)
      `).run(randomUUID(), dispatch.warehouse_id, inventory.id, line.quantity, dispatch.id, actor.id)
    }
  }
}

export function listDispatches(database) {
  return database.prepare(`
    SELECT dispatch.id, dispatch.dispatch_number AS dispatchNumber, dispatch.order_id AS orderId,
           dispatch.warehouse_id AS warehouseId, warehouse.name AS warehouseName,
           dispatch.status, dispatch.departed_at AS departedAt,
           dispatch.completed_at AS completedAt, order_record.order_number AS orderNumber,
           customer.full_name AS customerName,
           (SELECT count(*) FROM dispatch_serials serial WHERE serial.dispatch_id = dispatch.id) AS scannedSerialCount
    FROM dispatches dispatch
    JOIN orders order_record ON order_record.id = dispatch.order_id
    JOIN quotations quote ON quote.id = order_record.quote_id
    JOIN leads lead ON lead.id = quote.lead_id
    JOIN customers customer ON customer.id = lead.customer_id
    LEFT JOIN warehouses warehouse ON warehouse.id = dispatch.warehouse_id
    ORDER BY dispatch.created_at DESC
  `).all()
}

export function setDispatchWarehouse(database, dispatchId, warehouseId, actor) {
  assertRole(actor, ['ADMIN', 'WAREHOUSE'])
  const dispatch = dispatchRecord(database, dispatchId)
  if (dispatch.status !== 'PICKING') {
    throw new HttpError(409, 'DISPATCH_NOT_PICKING', 'Warehouse can only be assigned while picking')
  }
  const warehouse = database.prepare('SELECT id FROM warehouses WHERE id = ? AND is_active = 1').get(warehouseId)
  if (!warehouse) throw new HttpError(400, 'INVALID_WAREHOUSE', 'Select an active warehouse')
  const existingReservation = database.prepare(`
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'DISPATCH' AND reference_id = ? AND movement_type = 'RESERVE'
    LIMIT 1
  `).get(dispatchId)
  if (existingReservation && dispatch.warehouse_id !== warehouseId) {
    throw new HttpError(409, 'DISPATCH_WAREHOUSE_LOCKED', 'Warehouse cannot change after stock has been reserved')
  }
  const assign = database.transaction(() => {
    database.prepare('UPDATE dispatches SET warehouse_id = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?')
      .run(warehouseId, dispatchId)
    const updated = dispatchRecord(database, dispatchId)
    reserveDispatchStock(database, updated, actor)
  })
  try {
    assign()
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (String(error.message).includes('Insufficient available stock')) {
      throw new HttpError(409, 'STOCK_UNAVAILABLE', 'Insufficient stock is available for this order')
    }
    throw error
  }
  audit(database, actor, 'DISPATCH_WAREHOUSE_ASSIGNED', 'dispatches', dispatchId, { warehouseId })
  return dispatchRecord(database, dispatchId)
}

export function scanDispatchSerial(database, dispatchId, serialNumber, actor) {
  assertRole(actor, ['ADMIN', 'WAREHOUSE'])
  const dispatch = dispatchRecord(database, dispatchId)
  if (dispatch.status !== 'PICKING' || !dispatch.warehouse_id) {
    throw new HttpError(409, 'DISPATCH_NOT_PICKING', 'Assign a warehouse before scanning serials')
  }
  const serial = database.prepare(`
    SELECT serial.id, serial.inventory_item_id, serial.warehouse_id,
           serial.status, item.product_type, item.tracks_serial
    FROM product_serials serial
    JOIN inventory_items item ON item.id = serial.inventory_item_id
    WHERE serial.serial_number = ?
  `).get(serialNumber.trim())
  if (!serial) throw new HttpError(404, 'SERIAL_NOT_FOUND', 'Serial number not found')
  if (!serial.tracks_serial || serial.warehouse_id !== dispatch.warehouse_id) {
    throw new HttpError(409, 'SERIAL_NOT_MATCHED', 'Serial must be a tracked product in the dispatch warehouse')
  }
  const reservedForDispatch = database.prepare(`
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'DISPATCH' AND reference_id = ?
      AND movement_type = 'RESERVE' AND serial_id = ?
  `).get(dispatchId, serial.id)
  if (!reservedForDispatch || serial.status !== 'RESERVED') {
    throw new HttpError(409, 'SERIAL_NOT_RESERVED', 'Scan a serial reserved for this dispatch')
  }
  const required = quotationLines(database, dispatch.order_id)
    .filter((line) => line.product_type === serial.product_type)
    .reduce((sum, line) => sum + line.quantity, 0)
  if (!required) throw new HttpError(409, 'SERIAL_NOT_IN_BOM', 'This product type is not required by the accepted order BOM')
  const alreadyScanned = database.prepare(`
    SELECT count(*) AS count FROM dispatch_serials ds
    JOIN product_serials ps ON ps.id = ds.product_serial_id
    JOIN inventory_items item ON item.id = ps.inventory_item_id
    WHERE ds.dispatch_id = ? AND item.product_type = ?
  `).get(dispatchId, serial.product_type).count
  if (alreadyScanned >= Math.ceil(required)) {
    throw new HttpError(409, 'SERIAL_QUANTITY_COMPLETE', 'The required quantity of this serialized product is already scanned')
  }
  try {
    database.prepare('INSERT INTO dispatch_serials (dispatch_id, product_serial_id) VALUES (?, ?)')
      .run(dispatchId, serial.id)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'SERIAL_ALREADY_DISPATCHED', 'This serial is already linked to a dispatch')
    }
    if (String(error.message).includes('available serial')) {
      throw new HttpError(409, 'SERIAL_NOT_AVAILABLE', 'Serial is not available in the selected warehouse')
    }
    throw error
  }
  audit(database, actor, 'DISPATCH_SERIAL_SCANNED', 'dispatches', dispatchId, { serialNumber })
  return { serialNumber, productType: serial.product_type }
}

function verifyRequiredSerials(database, dispatch) {
  const needs = database.prepare(`
    SELECT item.product_type, sum(item.quantity) AS quantity
    FROM orders order_record
    JOIN quotation_items item ON item.quotation_id = order_record.quote_id
    WHERE order_record.id = ? AND EXISTS (
      SELECT 1 FROM inventory_items product
      WHERE product.product_type = item.product_type
        AND product.is_active = 1 AND product.tracks_serial = 1
    )
    GROUP BY item.product_type
  `).all(dispatch.order_id)
  for (const need of needs) {
    const count = database.prepare(`
      SELECT count(*) AS count FROM dispatch_serials dispatch_serial
      JOIN product_serials serial ON serial.id = dispatch_serial.product_serial_id
      JOIN inventory_items item ON item.id = serial.inventory_item_id
      WHERE dispatch_serial.dispatch_id = ? AND item.product_type = ?
    `).get(dispatch.id, need.product_type).count
    if (count < Math.ceil(need.quantity)) {
      throw new HttpError(409, 'SERIAL_SCAN_REQUIRED', `Scan ${Math.ceil(need.quantity) - count} more ${need.product_type} serial(s)`)
    }
  }
}

function issueReservedStock(database, dispatch, actor) {
  const reservations = database.prepare(`
    SELECT id, warehouse_id, inventory_item_id, serial_id, quantity
    FROM stock_movements
    WHERE reference_type = 'DISPATCH' AND reference_id = ? AND movement_type = 'RESERVE'
  `).all(dispatch.id)
  for (const movement of reservations) {
    database.prepare(`
      INSERT INTO stock_movements (
        id, warehouse_id, inventory_item_id, serial_id, movement_type, quantity,
        reference_type, reference_id, note, created_by
      ) VALUES (?, ?, ?, ?, 'UNRESERVE', ?, 'DISPATCH', ?, 'Release reservation for dispatch', ?)
    `).run(randomUUID(), movement.warehouse_id, movement.inventory_item_id, movement.serial_id, movement.quantity, dispatch.id, actor.id)
  }
  return reservations.filter((movement) => !movement.serial_id)
}

export function updateDispatchStatus(database, dispatchId, status, actor) {
  assertRole(actor, ['ADMIN', 'WAREHOUSE'])
  const dispatch = dispatchRecord(database, dispatchId)
  const allowed = {
    PICKING: ['READY'],
    READY: ['DISPATCHED'],
    DISPATCHED: ['DELIVERED'],
  }
  if (!allowed[dispatch.status]?.includes(status)) {
    throw new HttpError(409, 'INVALID_DISPATCH_TRANSITION', `Dispatch cannot move from ${dispatch.status} to ${status}`)
  }
  const transition = database.transaction(() => {
    if (status === 'READY') {
      if (!dispatch.warehouse_id) throw new HttpError(409, 'DISPATCH_WAREHOUSE_REQUIRED', 'Assign a warehouse before marking picking ready')
      verifyRequiredSerials(database, dispatch)
      reserveDispatchStock(database, dispatch, actor)
    }
    let bulkReservations = []
    if (status === 'DISPATCHED') bulkReservations = issueReservedStock(database, dispatch, actor)
    const departedAt = status === 'DISPATCHED' ? new Date().toISOString() : null
    const completedAt = status === 'DELIVERED' ? new Date().toISOString() : null
    database.prepare(`
      UPDATE dispatches
      SET status = ?,
          departed_at = coalesce(?, departed_at),
          completed_at = coalesce(?, completed_at),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(status, departedAt, completedAt, dispatchId)
    for (const movement of bulkReservations) {
      database.prepare(`
        INSERT INTO stock_movements (
          id, warehouse_id, inventory_item_id, movement_type, quantity,
          reference_type, reference_id, note, created_by
        ) VALUES (?, ?, ?, 'ISSUE', ?, 'DISPATCH', ?, 'Dispatch issue', ?)
      `).run(randomUUID(), movement.warehouse_id, movement.inventory_item_id, movement.quantity, dispatchId, actor.id)
    }
  })
  try {
    transition()
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (String(error.message).includes('Insufficient available stock')) {
      throw new HttpError(409, 'STOCK_UNAVAILABLE', 'Reserved stock is no longer available for dispatch')
    }
    throw error
  }
  audit(database, actor, `DISPATCH_${status}`, 'dispatches', dispatchId)
  return dispatchRecord(database, dispatchId)
}

const INSTALLATION_SELECT = `
  SELECT job.*, order_record.order_number,
         quote.id AS quote_id, quote.quote_number,
         customer.id AS customer_id, customer.full_name AS customer_name,
         customer.linked_user_id, customer.address AS customer_address,
         dispatch.status AS dispatch_status
  FROM installation_jobs job
  JOIN orders order_record ON order_record.id = job.order_id
  JOIN quotations quote ON quote.id = order_record.quote_id
  JOIN leads lead ON lead.id = quote.lead_id
  JOIN customers customer ON customer.id = lead.customer_id
  LEFT JOIN dispatches dispatch ON dispatch.order_id = order_record.id
`

function jobById(database, jobId) {
  return database.prepare(`${INSTALLATION_SELECT} WHERE job.id = ?`).get(jobId)
}

function assertJobAccess(database, job, actor) {
  if (actor.role === 'ADMIN') return
  if (actor.role === 'CUSTOMER' && job.linked_user_id === actor.id) return
  if (actor.role === 'TECHNICIAN' && database.prepare(`
    SELECT 1 FROM installation_assignments
    WHERE job_id = ? AND technician_user_id = ?
  `).get(job.id, actor.id)) return
  throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
}

function installationDto(database, job) {
  return {
    id: job.id,
    jobNumber: job.job_number,
    orderId: job.order_id,
    orderNumber: job.order_number,
    customerId: job.customer_id,
    customerName: job.customer_name,
    siteAddress: job.customer_address,
    status: job.status,
    dispatchStatus: job.dispatch_status,
    scheduledStart: job.scheduled_start,
    scheduledEnd: job.scheduled_end,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    generationTestResult: job.generation_test_result,
    notes: job.notes,
    assignments: database.prepare(`
      SELECT assignment.technician_user_id AS userId, user.full_name AS fullName
      FROM installation_assignments assignment
      JOIN users user ON user.id = assignment.technician_user_id
      WHERE assignment.job_id = ? ORDER BY user.full_name
    `).all(job.id),
    checklist: database.prepare(`
      SELECT id, check_code AS code, description, is_complete AS isComplete,
             completed_by AS completedBy, completed_at AS completedAt, notes
      FROM installation_checklists WHERE job_id = ? ORDER BY check_code
    `).all(job.id),
    customerSignedAt: database.prepare('SELECT signed_at FROM customer_signoffs WHERE job_id = ?')
      .get(job.id)?.signed_at ?? null,
  }
}

export function listInstallations(database, actor) {
  const jobs = database.prepare(`${INSTALLATION_SELECT} ORDER BY job.scheduled_start, job.created_at DESC`).all()
  return jobs.filter((job) => {
    if (actor.role === 'ADMIN') return true
    if (actor.role === 'CUSTOMER') return job.linked_user_id === actor.id
    if (actor.role === 'TECHNICIAN') {
      return Boolean(database.prepare(`
        SELECT 1 FROM installation_assignments
        WHERE job_id = ? AND technician_user_id = ?
      `).get(job.id, actor.id))
    }
    return false
  }).map((job) => installationDto(database, job))
}

export function listTechnicians(database, actor) {
  assertRole(actor, ['ADMIN'])
  return database.prepare(`
    SELECT id, full_name AS fullName FROM users
    WHERE role = 'TECHNICIAN' AND is_active = 1
    ORDER BY full_name COLLATE NOCASE
  `).all()
}

export function getInstallation(database, jobId, actor) {
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  assertJobAccess(database, job, actor)
  return installationDto(database, job)
}

export function scheduleInstallation(database, jobId, fields, actor) {
  assertRole(actor, ['ADMIN'])
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  if (!['SCHEDULED', 'READY'].includes(job.status)) {
    throw new HttpError(409, 'INSTALLATION_NOT_SCHEDULABLE', 'Installation can no longer be rescheduled')
  }
  const assign = database.transaction(() => {
    database.prepare(`
      UPDATE installation_jobs
      SET scheduled_start = ?, scheduled_end = ?, status = 'SCHEDULED',
          notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(fields.scheduledStart, fields.scheduledEnd ?? null, fields.notes ?? job.notes, jobId)
    database.prepare('DELETE FROM installation_assignments WHERE job_id = ?').run(jobId)
    const insert = database.prepare(`
      INSERT INTO installation_assignments (job_id, technician_user_id, assignment_role)
      SELECT ?, id, 'TECHNICIAN' FROM users
      WHERE id = ? AND role = 'TECHNICIAN' AND is_active = 1
    `)
    for (const technicianId of fields.technicianIds) {
      const result = insert.run(jobId, technicianId)
      if (!result.changes) throw new HttpError(400, 'INVALID_TECHNICIAN', 'Assignments must reference active Technician accounts')
    }
  })
  assign()
  audit(database, actor, 'INSTALLATION_SCHEDULED', 'installation_jobs', jobId, { technicianIds: fields.technicianIds })
  return getInstallation(database, jobId, actor)
}

function assertAssignedTechnician(database, jobId, actor) {
  if (actor.role === 'ADMIN') return
  if (actor.role !== 'TECHNICIAN' || !database.prepare(`
    SELECT 1 FROM installation_assignments WHERE job_id = ? AND technician_user_id = ?
  `).get(jobId, actor.id)) {
    throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  }
}

export function startInstallation(database, jobId, actor) {
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  assertAssignedTechnician(database, jobId, actor)
  if (!['SCHEDULED', 'READY'].includes(job.status) || job.dispatch_status !== 'DELIVERED') {
    throw new HttpError(409, 'INSTALLATION_NOT_READY', 'A delivered order is required before installation can start')
  }
  try {
    database.prepare(`
      UPDATE installation_jobs
      SET status = 'IN_PROGRESS', started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(jobId)
  } catch (error) {
    if (String(error.message).includes('required advance or full payment')) {
      throw new HttpError(409, 'PAYMENT_REQUIRED', 'Record the required advance or full payment before installation')
    }
    throw error
  }
  audit(database, actor, 'INSTALLATION_STARTED', 'installation_jobs', jobId)
  return getInstallation(database, jobId, actor)
}

export function completeChecklistItem(database, jobId, checkCode, fields, actor) {
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  assertAssignedTechnician(database, jobId, actor)
  if (job.status !== 'IN_PROGRESS') {
    throw new HttpError(409, 'INSTALLATION_NOT_IN_PROGRESS', 'Start the installation before updating its checklist')
  }
  const result = database.prepare(`
    UPDATE installation_checklists
    SET is_complete = ?, completed_by = ?, completed_at = CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END,
        notes = ?
    WHERE job_id = ? AND check_code = ?
  `).run(fields.isComplete ? 1 : 0, fields.isComplete ? actor.id : null, fields.isComplete ? 1 : 0, fields.notes, jobId, checkCode)
  if (!result.changes) throw new HttpError(404, 'CHECKLIST_ITEM_NOT_FOUND', 'Checklist item not found')
  audit(database, actor, 'INSTALLATION_CHECKLIST_UPDATED', 'installation_jobs', jobId, { checkCode, isComplete: fields.isComplete })
  return getInstallation(database, jobId, actor)
}

export function recordInstallationTime(database, jobId, fields, actor) {
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  assertAssignedTechnician(database, jobId, actor)
  if (job.status !== 'IN_PROGRESS') {
    throw new HttpError(409, 'INSTALLATION_NOT_IN_PROGRESS', 'Time can only be recorded for an in-progress job')
  }
  const start = Date.parse(fields.startedAt)
  const end = fields.endedAt ? Date.parse(fields.endedAt) : null
  const hours = end === null ? null : (end - start) / 3_600_000
  if (hours !== null && hours <= 0) throw new HttpError(400, 'INVALID_TIME_LOG', 'End time must be after start time')
  const id = randomUUID()
  database.prepare(`
    INSERT INTO installation_time_logs (
      id, job_id, technician_user_id, started_at, ended_at, hours, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, jobId, actor.id, new Date(start).toISOString(), end === null ? null : new Date(end).toISOString(), hours, fields.notes)
  audit(database, actor, 'INSTALLATION_TIME_RECORDED', 'installation_time_logs', id, { jobId, hours })
  return { id, jobId, startedAt: new Date(start).toISOString(), endedAt: end === null ? null : new Date(end).toISOString(), hours }
}

export function recordGenerationTest(database, jobId, resultText, actor) {
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  assertAssignedTechnician(database, jobId, actor)
  if (job.status !== 'IN_PROGRESS') {
    throw new HttpError(409, 'INSTALLATION_NOT_IN_PROGRESS', 'Commissioning results require an in-progress job')
  }
  database.prepare(`
    UPDATE installation_jobs
    SET generation_test_result = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(resultText.trim(), jobId)
  audit(database, actor, 'INSTALLATION_TEST_RECORDED', 'installation_jobs', jobId)
  return getInstallation(database, jobId, actor)
}

export function customerSignoff(database, jobId, fields, actor) {
  if (actor.role !== 'CUSTOMER') throw new HttpError(403, 'FORBIDDEN', 'Only the customer can sign off an installation')
  const job = jobById(database, jobId)
  if (!job || job.linked_user_id !== actor.id) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  if (job.status !== 'IN_PROGRESS' || !job.generation_test_result) {
    throw new HttpError(409, 'INSTALLATION_NOT_READY_FOR_SIGNOFF', 'Review the completed commissioning test before signing')
  }
  const unfinished = database.prepare(`
    SELECT count(*) AS count FROM installation_checklists
    WHERE job_id = ? AND is_complete = 0
  `).get(jobId).count
  if (unfinished) throw new HttpError(409, 'CHECKLIST_INCOMPLETE', 'All installation checklist items must be complete before sign-off')
  const id = randomUUID()
  try {
    database.prepare(`
      INSERT INTO customer_signoffs (id, job_id, customer_id, customer_name, signed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, jobId, job.customer_id, job.customer_name, new Date().toISOString(), fields.notes)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'SIGNOFF_ALREADY_RECORDED', 'This installation already has a customer sign-off')
    }
    throw error
  }
  audit(database, actor, 'CUSTOMER_INSTALLATION_SIGNOFF', 'customer_signoffs', id, { jobId })
  return getInstallation(database, jobId, actor)
}

export function completeInstallation(database, jobId, actor) {
  const job = jobById(database, jobId)
  if (!job) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'Installation job not found')
  assertAssignedTechnician(database, jobId, actor)
  const incomplete = database.prepare(`
    SELECT count(*) AS count FROM installation_checklists
    WHERE job_id = ? AND is_complete = 0
  `).get(jobId).count
  const signoff = database.prepare('SELECT 1 FROM customer_signoffs WHERE job_id = ?').get(jobId)
  if (job.status !== 'IN_PROGRESS' || !job.generation_test_result || incomplete || !signoff) {
    throw new HttpError(409, 'INSTALLATION_INCOMPLETE', 'Complete the checklist and test, then obtain customer sign-off before closing')
  }
  database.prepare(`
    UPDATE installation_jobs
    SET status = 'COMPLETED', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(jobId)
  audit(database, actor, 'INSTALLATION_COMPLETED', 'installation_jobs', jobId)
  return getInstallation(database, jobId, actor)
}

function deliveredSerial(database, serialNumber) {
  return database.prepare(`
    SELECT equipment.*, serial.id AS serial_id, serial.serial_number, serial.product_type,
           serial.product_name, serial.customer_id, serial.customer_name,
           serial.delivery_completed_at, serial.warranty_starts_on,
           serial.warranty_ends_on, serial.warranty_status
    FROM v_customer_equipment_serials serial
    JOIN product_serials equipment ON equipment.serial_number = serial.serial_number
    WHERE serial.serial_number = ?
  `).get(serialNumber)
}

export function lookupSerial(database, serialNumber, actor) {
  const result = deliveredSerial(database, serialNumber.trim())
  if (!result) throw new HttpError(404, 'SERIAL_NOT_FOUND', 'Delivered serial number not found')
  if (actor.role === 'CUSTOMER') {
    const customer = database.prepare('SELECT id FROM customers WHERE linked_user_id = ?').get(actor.id)
    if (!customer || customer.id !== result.customer_id) throw new HttpError(404, 'SERIAL_NOT_FOUND', 'Delivered serial number not found')
  } else if (!['ADMIN', 'SUPPORT'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Serial lookup is not available for this role')
  }
  return {
    serialNumber: result.serial_number,
    productType: result.product_type,
    productName: result.product_name,
    customerId: result.customer_id,
    customerName: result.customer_name,
    deliveryCompletedAt: result.delivery_completed_at,
    warranty: {
      status: result.warranty_status || 'NOT_ACTIVATED',
      startsOn: result.warranty_starts_on,
      endsOn: result.warranty_ends_on,
      activeToday: Boolean(
        result.warranty_status === 'ACTIVE'
        && result.warranty_starts_on <= new Date().toISOString().slice(0, 10)
        && result.warranty_ends_on >= new Date().toISOString().slice(0, 10),
      ),
    },
  }
}

const TICKET_SELECT = `
  SELECT ticket.*, customer.full_name AS customer_name, customer.email AS customer_email,
         customer.linked_user_id, assigned.full_name AS assignee_name,
         quote.quote_number, order_record.order_number
  FROM service_tickets ticket
  JOIN customers customer ON customer.id = ticket.customer_id
  LEFT JOIN users assigned ON assigned.id = ticket.assigned_to
  LEFT JOIN orders order_record ON order_record.id = ticket.order_id
  LEFT JOIN quotations quote ON quote.id = order_record.quote_id
`

function ticketById(database, ticketId) {
  return database.prepare(`${TICKET_SELECT} WHERE ticket.id = ?`).get(ticketId)
}

function assertTicketAccess(ticket, actor) {
  if (actor.role === 'ADMIN' || actor.role === 'SUPPORT') return
  if (actor.role === 'CUSTOMER' && ticket.linked_user_id === actor.id) return
  throw new HttpError(404, 'SERVICE_TICKET_NOT_FOUND', 'Service ticket not found')
}

function ticketDto(database, ticket) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    customerId: ticket.customer_id,
    customerName: ticket.customer_name,
    subject: ticket.subject,
    description: ticket.description,
    faultCode: ticket.fault_code,
    status: ticket.status,
    assigneeName: ticket.assignee_name,
    orderNumber: ticket.order_number,
    openedAt: ticket.opened_at,
    serials: database.prepare(`
      SELECT serial.serial_number AS serialNumber, item.name AS productName, item.product_type AS productType
      FROM service_ticket_items ticket_item
      JOIN product_serials serial ON serial.id = ticket_item.product_serial_id
      JOIN inventory_items item ON item.id = serial.inventory_item_id
      WHERE ticket_item.ticket_id = ?
    `).all(ticket.id),
    resolutions: database.prepare(`
      SELECT id, resolution_type AS type, warranty_coverage AS warrantyCoverage,
             parts_charge AS partsCharge, labour_charge AS labourCharge,
             notes, resolved_at AS resolvedAt
      FROM service_resolutions WHERE ticket_id = ? ORDER BY resolved_at
    `).all(ticket.id),
  }
}

export function listServiceTickets(database, actor) {
  if (!['ADMIN', 'SUPPORT', 'CUSTOMER'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Service tickets are not available for this role')
  }
  const rows = database.prepare(`${TICKET_SELECT} ORDER BY ticket.opened_at DESC`).all()
    .filter((ticket) => actor.role !== 'CUSTOMER' || ticket.linked_user_id === actor.id)
  return rows.map((ticket) => ticketDto(database, ticket))
}

export function createServiceTicket(database, fields, actor) {
  let customerId
  if (actor.role === 'CUSTOMER') {
    customerId = database.prepare('SELECT id FROM customers WHERE linked_user_id = ?').get(actor.id)?.id
    if (!customerId) throw new HttpError(404, 'CUSTOMER_PROFILE_NOT_FOUND', 'Customer profile not found')
  } else {
    assertRole(actor, ['ADMIN', 'SUPPORT'])
    customerId = fields.customerId
  }
  const customer = database.prepare(`
    SELECT id, is_archived FROM customers WHERE id = ?
  `).get(customerId)
  if (!customer || customer.is_archived) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')

  if (fields.orderId) {
    const order = database.prepare(`
      SELECT order_record.id, lead.customer_id
      FROM orders order_record
      JOIN quotations quote ON quote.id = order_record.quote_id
      JOIN leads lead ON lead.id = quote.lead_id
      WHERE order_record.id = ?
    `).get(fields.orderId)
    if (!order || order.customer_id !== customerId) {
      throw new HttpError(400, 'ORDER_CUSTOMER_MISMATCH', 'The selected order does not belong to this customer')
    }
  }

  const ticketId = randomUUID()
  const ticketNumber = `SR-${randomUUID().slice(0, 8).toUpperCase()}`
  const create = database.transaction(() => {
    database.prepare(`
      INSERT INTO service_tickets (
        id, ticket_number, customer_id, order_id, subject, description,
        fault_code, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ticketId, ticketNumber, customerId, fields.orderId ?? null, fields.subject, fields.description, fields.faultCode, actor.id)
    if (fields.serialNumber) {
      const serial = database.prepare(`
        SELECT equipment.id, delivered.customer_id
        FROM v_customer_equipment_serials delivered
        JOIN product_serials equipment ON equipment.serial_number = delivered.serial_number
        WHERE delivered.serial_number = ?
      `).get(fields.serialNumber)
      if (!serial || serial.customer_id !== customerId) {
        throw new HttpError(404, 'CUSTOMER_SERIAL_NOT_FOUND', 'Delivered serial does not belong to this customer')
      }
      database.prepare(`
        INSERT INTO service_ticket_items (id, ticket_id, product_serial_id, symptom)
        VALUES (?, ?, ?, ?)
      `).run(randomUUID(), ticketId, serial.id, fields.description)
    }
  })
  create()
  audit(database, actor, 'SERVICE_TICKET_CREATED', 'service_tickets', ticketId, { customerId })
  return ticketDto(database, ticketById(database, ticketId))
}

export function assignServiceTicket(database, ticketId, supportUserId, actor) {
  assertRole(actor, ['ADMIN', 'SUPPORT'])
  const ticket = ticketById(database, ticketId)
  if (!ticket) throw new HttpError(404, 'SERVICE_TICKET_NOT_FOUND', 'Service ticket not found')
  const assignee = database.prepare(`
    SELECT id FROM users WHERE id = ? AND role = 'SUPPORT' AND is_active = 1
  `).get(supportUserId)
  if (!assignee) throw new HttpError(400, 'INVALID_SUPPORT_ASSIGNMENT', 'Assign an active Support account')
  database.prepare(`
    UPDATE service_tickets SET assigned_to = ?, status = 'IN_PROGRESS',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(supportUserId, ticketId)
  audit(database, actor, 'SERVICE_TICKET_ASSIGNED', 'service_tickets', ticketId, { supportUserId })
  return ticketDto(database, ticketById(database, ticketId))
}

export function resolveServiceTicket(database, ticketId, fields, actor) {
  assertRole(actor, ['ADMIN', 'SUPPORT'])
  const ticket = ticketById(database, ticketId)
  if (!ticket) throw new HttpError(404, 'SERVICE_TICKET_NOT_FOUND', 'Service ticket not found')
  if (!['OPEN', 'IN_PROGRESS'].includes(ticket.status)) {
    throw new HttpError(409, 'SERVICE_TICKET_NOT_RESOLVABLE', 'Ticket cannot be resolved in its current state')
  }
  const serials = database.prepare(`
    SELECT ticket_item.product_serial_id, warranty.status AS warranty_status,
           warranty.starts_on, warranty.ends_on
    FROM service_ticket_items ticket_item
    LEFT JOIN warranty_records warranty ON warranty.product_serial_id = ticket_item.product_serial_id
    WHERE ticket_item.ticket_id = ?
  `).all(ticketId)
  const today = new Date().toISOString().slice(0, 10)
  const covered = serials.length > 0 && serials.every((serial) => (
    serial.warranty_status === 'ACTIVE'
    && serial.starts_on <= today
    && serial.ends_on >= today
  ))
  const unspecified = serials.some((serial) => serial.warranty_status === 'UNSPECIFIED')
  const warrantyCoverage = covered ? 'COVERED' : unspecified ? 'UNSPECIFIED' : 'NOT_COVERED'
  if (!covered && (fields.partsCharge === undefined || fields.labourCharge === undefined)) {
    throw new HttpError(400, 'SERVICE_CHARGES_REQUIRED', 'Enter configured parts and labour charges when coverage is not active')
  }
  const partsCharge = covered ? 0 : fields.partsCharge
  const labourCharge = covered ? 0 : fields.labourCharge
  const resolutionId = randomUUID()
  const resolve = database.transaction(() => {
    database.prepare(`
      INSERT INTO service_resolutions (
        id, ticket_id, product_serial_id, resolution_type, warranty_coverage,
        parts_charge, labour_charge, notes, resolved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      resolutionId,
      ticketId,
      covered ? serials[0].product_serial_id : null,
      fields.type,
      warrantyCoverage,
      partsCharge,
      labourCharge,
      fields.notes,
      actor.id,
    )
    database.prepare(`
      UPDATE service_tickets SET status = 'WAITING_CUSTOMER',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(ticketId)
  })
  resolve()
  audit(database, actor, 'SERVICE_TICKET_RESOLVED', 'service_resolutions', resolutionId, { ticketId, warrantyCoverage })
  return ticketDto(database, ticketById(database, ticketId))
}

export function confirmServiceResolution(database, ticketId, fields, actor) {
  if (actor.role !== 'CUSTOMER') throw new HttpError(403, 'FORBIDDEN', 'Only the customer can confirm service completion')
  const ticket = ticketById(database, ticketId)
  if (!ticket || ticket.linked_user_id !== actor.id) {
    throw new HttpError(404, 'SERVICE_TICKET_NOT_FOUND', 'Service ticket not found')
  }
  if (ticket.status !== 'WAITING_CUSTOMER') {
    throw new HttpError(409, 'SERVICE_CONFIRMATION_NOT_PENDING', 'This service ticket is not awaiting customer confirmation')
  }
  const confirm = database.transaction(() => {
    const prior = database.prepare('SELECT id FROM customer_service_confirmations WHERE ticket_id = ?').get(ticketId)
    if (prior) {
      database.prepare(`
        UPDATE customer_service_confirmations
        SET confirmed = ?, confirmed_at = CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END,
            notes = ?
        WHERE ticket_id = ?
      `).run(fields.confirmed ? 1 : 0, fields.confirmed ? 1 : 0, fields.notes, ticketId)
    } else {
      database.prepare(`
        INSERT INTO customer_service_confirmations (
          id, ticket_id, customer_id, confirmed, confirmed_at, notes
        ) VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, ?)
      `).run(randomUUID(), ticketId, ticket.customer_id, fields.confirmed ? 1 : 0, fields.confirmed ? 1 : 0, fields.notes)
    }
    if (fields.confirmed) {
      database.prepare(`
        UPDATE service_tickets SET status = 'CLOSED', closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(ticketId)
    } else {
      database.prepare(`
        UPDATE service_tickets SET status = 'IN_PROGRESS',
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(ticketId)
    }
  })
  confirm()
  audit(database, actor, 'SERVICE_CUSTOMER_CONFIRMATION', 'service_tickets', ticketId, { confirmed: fields.confirmed })
  return ticketDto(database, ticketById(database, ticketId))
}

export function createExpense(database, fields, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  if (fields.orderId && !database.prepare('SELECT 1 FROM orders WHERE id = ?').get(fields.orderId)) {
    throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
  }
  const id = randomUUID()
  database.prepare(`
    INSERT INTO expenses (id, order_id, expense_type, description, amount, incurred_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fields.orderId ?? null, fields.type, fields.description, fields.amount, fields.incurredAt, actor.id)
  audit(database, actor, 'PROJECT_EXPENSE_RECORDED', 'expenses', id, { orderId: fields.orderId, amount: fields.amount })
  return database.prepare(`
    SELECT id, order_id AS orderId, expense_type AS type, description, amount, incurred_at AS incurredAt
    FROM expenses WHERE id = ?
  `).get(id)
}

export function listPayrollOptions(database, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  return database.prepare(`
    SELECT job.id AS jobId, job.job_number AS jobNumber,
           customer.full_name AS customerName,
           assignment.technician_user_id AS technicianUserId,
           user.full_name AS technicianName,
           coalesce(logged.hours, 0) AS loggedHours,
           coalesce(payroll.hours, 0) AS paidHours,
           max(0, coalesce(logged.hours, 0) - coalesce(payroll.hours, 0)) AS availableHours
    FROM installation_jobs job
    JOIN orders order_record ON order_record.id = job.order_id
    JOIN quotations quote ON quote.id = order_record.quote_id
    JOIN leads lead ON lead.id = quote.lead_id
    JOIN customers customer ON customer.id = lead.customer_id
    JOIN installation_assignments assignment ON assignment.job_id = job.id
    JOIN users user ON user.id = assignment.technician_user_id AND user.is_active = 1
    LEFT JOIN (
      SELECT job_id, technician_user_id, sum(hours) AS hours
      FROM installation_time_logs WHERE ended_at IS NOT NULL
      GROUP BY job_id, technician_user_id
    ) logged ON logged.job_id = job.id AND logged.technician_user_id = assignment.technician_user_id
    LEFT JOIN (
      SELECT job_id, technician_user_id, sum(hours) AS hours
      FROM technician_payroll_entries
      GROUP BY job_id, technician_user_id
    ) payroll ON payroll.job_id = job.id AND payroll.technician_user_id = assignment.technician_user_id
    WHERE job.status IN ('IN_PROGRESS', 'COMPLETED')
    ORDER BY job.created_at DESC, user.full_name
  `).all()
}

export function listPayroll(database, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  return database.prepare(`
    SELECT payroll.id, payroll.job_id AS jobId, job.job_number AS jobNumber,
           order_record.order_number AS orderNumber,
           payroll.technician_user_id AS technicianUserId,
           user.full_name AS technicianName, payroll.hours,
           payroll.hourly_rate AS hourlyRate, payroll.amount,
           payroll.paid_at AS paidAt, payroll.notes
    FROM technician_payroll_entries payroll
    JOIN installation_jobs job ON job.id = payroll.job_id
    JOIN orders order_record ON order_record.id = job.order_id
    JOIN users user ON user.id = payroll.technician_user_id
    ORDER BY payroll.created_at DESC
  `).all()
}

export function createPayroll(database, fields, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  const id = randomUUID()
  const record = database.transaction(() => {
    const assignment = database.prepare(`
      SELECT job.id
      FROM installation_jobs job
      JOIN installation_assignments assignment ON assignment.job_id = job.id
      JOIN users user ON user.id = assignment.technician_user_id
      WHERE job.id = ? AND assignment.technician_user_id = ?
        AND user.role = 'TECHNICIAN' AND user.is_active = 1
        AND job.status IN ('IN_PROGRESS', 'COMPLETED')
    `).get(fields.jobId, fields.technicianUserId)
    if (!assignment) {
      throw new HttpError(400, 'INVALID_PAYROLL_ASSIGNMENT', 'Payroll must match an active Technician assigned to an in-progress or completed job')
    }
    const loggedHours = database.prepare(`
      SELECT coalesce(sum(hours), 0) AS hours FROM installation_time_logs
      WHERE job_id = ? AND technician_user_id = ? AND ended_at IS NOT NULL
    `).get(fields.jobId, fields.technicianUserId).hours
    const paidHours = database.prepare(`
      SELECT coalesce(sum(hours), 0) AS hours FROM technician_payroll_entries
      WHERE job_id = ? AND technician_user_id = ?
    `).get(fields.jobId, fields.technicianUserId).hours
    if (fields.hours > loggedHours - paidHours) {
      throw new HttpError(409, 'PAYROLL_HOURS_EXCEED_LOGS', 'Payroll hours cannot exceed unprocessed, completed technician time logs')
    }
    database.prepare(`
      INSERT INTO technician_payroll_entries (
        id, job_id, technician_user_id, hours, hourly_rate, amount, paid_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fields.jobId,
      fields.technicianUserId,
      fields.hours,
      fields.hourlyRate ?? null,
      fields.amount ?? null,
      fields.paidAt ?? null,
      fields.notes,
    )
  })
  record()
  audit(database, actor, 'TECHNICIAN_PAYROLL_RECORDED', 'technician_payroll_entries', id, { jobId: fields.jobId, hours: fields.hours })
  return listPayroll(database, actor).find((entry) => entry.id === id)
}

export function listInvoices(database, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  return database.prepare(`
    SELECT invoice.id, invoice.invoice_number AS invoiceNumber,
           invoice.order_id AS orderId, order_record.order_number AS orderNumber,
           invoice.status, invoice.issued_at AS issuedAt, invoice.due_at AS dueAt,
           coalesce(sum(item.quantity * item.unit_price), 0) AS totalAmount
    FROM invoices invoice
    JOIN orders order_record ON order_record.id = invoice.order_id
    LEFT JOIN invoice_items item ON item.invoice_id = invoice.id
    GROUP BY invoice.id ORDER BY invoice.created_at DESC
  `).all()
}

export function createInvoice(database, fields, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  const order = database.prepare(`
    SELECT order_record.id, order_record.status, order_record.quote_id
    FROM orders order_record WHERE order_record.id = ?
  `).get(fields.orderId)
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (!['CONFIRMED', 'COMPLETED'].includes(order.status)) {
    throw new HttpError(409, 'ORDER_NOT_INVOICABLE', 'Only a confirmed order can be invoiced')
  }
  const items = database.prepare(`
    SELECT description, quantity, unit, unit_price AS unitPrice
    FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order
  `).all(order.quote_id)
  if (!items.length || items.some((item) => item.unitPrice === null)) {
    throw new HttpError(409, 'QUOTE_NOT_FULLY_PRICED', 'Configure a price for every quotation item before creating an invoice')
  }
  const id = randomUUID()
  const number = `INV-${randomUUID().slice(0, 8).toUpperCase()}`
  const create = database.transaction(() => {
    database.prepare(`
      INSERT INTO invoices (id, invoice_number, order_id, due_at)
      VALUES (?, ?, ?, ?)
    `).run(id, number, order.id, fields.dueAt ?? null)
    const insert = database.prepare(`
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    items.forEach((item, index) => {
      insert.run(randomUUID(), id, item.description, item.quantity, item.unit, item.unitPrice, index)
    })
  })
  create()
  audit(database, actor, 'INVOICE_CREATED', 'invoices', id, { orderId: order.id })
  return database.prepare(`
    SELECT id, invoice_number AS invoiceNumber, order_id AS orderId, status,
           issued_at AS issuedAt, due_at AS dueAt FROM invoices WHERE id = ?
  `).get(id)
}

export function updateInvoiceStatus(database, invoiceId, status, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  const invoice = database.prepare('SELECT id, status FROM invoices WHERE id = ?').get(invoiceId)
  if (!invoice) throw new HttpError(404, 'INVOICE_NOT_FOUND', 'Invoice not found')
  if (invoice.status !== 'DRAFT' || !['ISSUED', 'VOID'].includes(status)) {
    throw new HttpError(409, 'INVALID_INVOICE_TRANSITION', 'Only a draft invoice can be issued or voided')
  }
  database.prepare(`
    UPDATE invoices
    SET status = ?, issued_at = CASE WHEN ? = 'ISSUED' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(status, status, invoiceId)
  audit(database, actor, `INVOICE_${status}`, 'invoices', invoiceId)
  return database.prepare(`
    SELECT id, invoice_number AS invoiceNumber, order_id AS orderId, status,
           issued_at AS issuedAt, due_at AS dueAt FROM invoices WHERE id = ?
  `).get(invoiceId)
}

export function createStockPurchase(database, fields, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  if (!database.prepare('SELECT 1 FROM warehouses WHERE id = ? AND is_active = 1').get(fields.warehouseId)) {
    throw new HttpError(400, 'INVALID_WAREHOUSE', 'Select an active warehouse')
  }
  if (fields.orderId && !database.prepare('SELECT 1 FROM orders WHERE id = ?').get(fields.orderId)) {
    throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
  }
  const inventoryItems = fields.items.map((line) => database.prepare(`
    SELECT id FROM inventory_items WHERE id = ? AND is_active = 1
  `).get(line.inventoryItemId))
  if (inventoryItems.some((item) => !item)) {
    throw new HttpError(400, 'INVALID_INVENTORY_ITEM', 'All purchase lines must reference active inventory items')
  }
  const id = randomUUID()
  const purchaseNumber = `PO-${randomUUID().slice(0, 8).toUpperCase()}`
  const purchaseItems = fields.items.map((line, sortOrder) => ({
    id: randomUUID(),
    ...line,
    sortOrder,
  }))
  const create = database.transaction(() => {
    database.prepare(`
      INSERT INTO stock_purchases (
        id, purchase_number, warehouse_id, order_id, supplier_name, status, purchased_at
      ) VALUES (?, ?, ?, ?, ?, 'ORDERED', ?)
    `).run(id, purchaseNumber, fields.warehouseId, fields.orderId ?? null, fields.supplierName, fields.purchasedAt)
    const insert = database.prepare(`
      INSERT INTO stock_purchase_items (
        id, purchase_id, inventory_item_id, quantity, unit_cost, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    purchaseItems.forEach((line) => {
      insert.run(line.id, id, line.inventoryItemId, line.quantity, line.unitCost ?? null, line.sortOrder)
    })
  })
  create()
  audit(database, actor, 'STOCK_PURCHASE_CREATED', 'stock_purchases', id, { itemCount: fields.items.length })
  return getStockPurchase(database, id, actor)
}

export function getStockPurchase(database, purchaseId, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE', 'WAREHOUSE'])
  const purchase = database.prepare(`
    SELECT purchase.id, purchase.purchase_number AS purchaseNumber,
           purchase.warehouse_id AS warehouseId, warehouse.name AS warehouseName,
           purchase.order_id AS orderId, purchase.supplier_name AS supplierName,
           purchase.status, purchase.purchased_at AS purchasedAt,
           purchase.received_at AS receivedAt
    FROM stock_purchases purchase
    JOIN warehouses warehouse ON warehouse.id = purchase.warehouse_id
    WHERE purchase.id = ?
  `).get(purchaseId)
  if (!purchase) throw new HttpError(404, 'PURCHASE_NOT_FOUND', 'Stock purchase not found')
  return {
    ...purchase,
    items: database.prepare(`
      SELECT purchase_item.id, purchase_item.inventory_item_id AS inventoryItemId,
             item.sku, item.name, item.product_type AS productType,
             item.tracks_serial AS tracksSerial, purchase_item.quantity,
             purchase_item.unit_cost AS unitCost
      FROM stock_purchase_items purchase_item
      JOIN inventory_items item ON item.id = purchase_item.inventory_item_id
      WHERE purchase_item.purchase_id = ? ORDER BY purchase_item.sort_order
    `).all(purchaseId),
  }
}

export function listStockPurchases(database, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE', 'WAREHOUSE'])
  return database.prepare(`
    SELECT purchase.id, purchase.purchase_number AS purchaseNumber,
           purchase.warehouse_id AS warehouseId, warehouse.name AS warehouseName,
           purchase.order_id AS orderId, purchase.supplier_name AS supplierName,
           purchase.status, purchase.purchased_at AS purchasedAt,
           purchase.received_at AS receivedAt,
           (SELECT count(*) FROM stock_purchase_items item WHERE item.purchase_id = purchase.id) AS lineCount
    FROM stock_purchases purchase
    JOIN warehouses warehouse ON warehouse.id = purchase.warehouse_id
    ORDER BY purchase.created_at DESC
  `).all()
}

export function receiveStockPurchase(database, purchaseId, fields, actor) {
  assertRole(actor, ['ADMIN', 'WAREHOUSE'])
  const purchase = database.prepare(`
    SELECT id, warehouse_id, status FROM stock_purchases WHERE id = ?
  `).get(purchaseId)
  if (!purchase) throw new HttpError(404, 'PURCHASE_NOT_FOUND', 'Stock purchase not found')
  if (purchase.status !== 'ORDERED') {
    throw new HttpError(409, 'PURCHASE_NOT_RECEIVABLE', 'Only an ordered purchase can be received')
  }
  const receive = database.transaction(() => {
    const lines = database.prepare(`
      SELECT purchase_item.id, purchase_item.inventory_item_id, purchase_item.quantity,
             item.tracks_serial
      FROM stock_purchase_items purchase_item
      JOIN inventory_items item ON item.id = purchase_item.inventory_item_id
      WHERE purchase_item.purchase_id = ?
    `).all(purchaseId)
    const serialInputs = new Map(fields.serials.map((entry) => [entry.purchaseItemId, entry.serialNumbers]))
    if (serialInputs.size !== fields.serials.length) {
      throw new HttpError(400, 'DUPLICATE_PURCHASE_ITEM', 'Each purchase item can appear only once in the receipt')
    }
    for (const suppliedId of serialInputs.keys()) {
      if (!lines.some((line) => line.id === suppliedId)) {
        throw new HttpError(400, 'INVALID_PURCHASE_ITEM', 'Serial numbers must reference an item from this purchase')
      }
    }
    for (const line of lines) {
      if (line.tracks_serial) {
        const serialNumbers = serialInputs.get(line.id)
        if (!Number.isInteger(line.quantity) || !serialNumbers || serialNumbers.length !== line.quantity) {
          throw new HttpError(400, 'SERIALS_REQUIRED', 'Enter one unique serial number for each serialized unit')
        }
        for (const serialNumber of serialNumbers) {
          const serialId = randomUUID()
          database.prepare(`
            INSERT INTO product_serials (id, inventory_item_id, warehouse_id, serial_number)
            VALUES (?, ?, ?, ?)
          `).run(serialId, line.inventory_item_id, purchase.warehouse_id, serialNumber)
          database.prepare(`
            INSERT INTO stock_movements (
              id, warehouse_id, inventory_item_id, serial_id, movement_type, quantity,
              reference_type, reference_id, note, created_by
            ) VALUES (?, ?, ?, ?, 'RECEIPT', 1, 'PURCHASE', ?, 'Serialized stock purchase receipt', ?)
          `).run(randomUUID(), purchase.warehouse_id, line.inventory_item_id, serialId, purchaseId, actor.id)
        }
      } else {
        if (serialInputs.has(line.id)) {
          throw new HttpError(400, 'SERIAL_NOT_ALLOWED', 'Do not supply serial numbers for non-serialized items')
        }
        database.prepare(`
          INSERT INTO stock_movements (
            id, warehouse_id, inventory_item_id, movement_type, quantity,
            reference_type, reference_id, note, created_by
          ) VALUES (?, ?, ?, 'RECEIPT', ?, 'PURCHASE', ?, 'Stock purchase receipt', ?)
        `).run(randomUUID(), purchase.warehouse_id, line.inventory_item_id, line.quantity, purchaseId, actor.id)
      }
    }
    database.prepare(`
      UPDATE stock_purchases SET status = 'RECEIVED',
          received_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(purchaseId)
  })
  try {
    receive()
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'SERIAL_ALREADY_EXISTS', 'One of those serial numbers is already recorded')
    }
    throw error
  }
  audit(database, actor, 'STOCK_PURCHASE_RECEIVED', 'stock_purchases', purchaseId)
  return database.prepare(`
    SELECT id, purchase_number AS purchaseNumber, status, received_at AS receivedAt
    FROM stock_purchases WHERE id = ?
  `).get(purchaseId)
}

export function getFinanceReport(database, { from, to }, actor) {
  assertRole(actor, ['ADMIN', 'FINANCE'])
  const projects = database.prepare(`
    SELECT report.order_id AS orderId, report.order_number AS orderNumber,
           report.customer_name AS customerName, report.order_status AS orderStatus,
           report.is_demo AS isDemo, report.revenue_amount AS revenueAmount,
           report.project_cost_amount AS projectCostAmount,
           report.costs_complete AS costsComplete,
           report.project_profit_amount AS projectProfitAmount
    FROM v_project_profitability report
    JOIN orders order_record ON order_record.id = report.order_id
    WHERE (? IS NULL OR date(order_record.created_at) >= date(?))
      AND (? IS NULL OR date(order_record.created_at) <= date(?))
    ORDER BY order_record.created_at DESC
  `).all(from ?? null, from ?? null, to ?? null, to ?? null)
  const completed = projects.filter((project) => project.costsComplete && project.revenueAmount !== null)
  return {
    from: from ?? null,
    to: to ?? null,
    projectCount: projects.length,
    knownRevenue: projects.reduce((total, project) => total + (project.revenueAmount ?? 0), 0),
    knownCosts: projects.reduce((total, project) => total + (project.projectCostAmount ?? 0), 0),
    completeProfitTotal: completed.length
      ? completed.reduce((total, project) => total + project.projectProfitAmount, 0)
      : null,
    incompleteProjectCount: projects.filter((project) => !project.costsComplete || project.revenueAmount === null).length,
    projects,
  }
}

export function getCustomerBusinessRecords(database, actor) {
  if (actor.role !== 'CUSTOMER') throw new HttpError(403, 'FORBIDDEN', 'Customer records are private to the customer role')
  const customer = database.prepare('SELECT id FROM customers WHERE linked_user_id = ?').get(actor.id)
  if (!customer) throw new HttpError(404, 'CUSTOMER_PROFILE_NOT_FOUND', 'Customer profile not found')
  const orders = listOrders(database, actor)
  const warranties = database.prepare(`
    SELECT product_name AS productName, product_type AS productType,
           serial_number AS serialNumber, delivery_completed_at AS deliveredAt,
           warranty_starts_on AS startsOn, warranty_ends_on AS endsOn,
           warranty_status AS status
    FROM v_customer_equipment_serials
    WHERE customer_id = ?
    ORDER BY delivery_completed_at DESC
  `).all(customer.id)
  const serviceTickets = listServiceTickets(database, actor)
  return { orders, warranties, serviceTickets }
}
