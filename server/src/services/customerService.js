import { randomUUID } from 'node:crypto'
import { findUserByEmail } from '../database/users.js'
import { HttpError } from '../errors.js'
import { insertPreparedUser, prepareUser } from './userService.js'

const CUSTOMER_SELECT = `
  SELECT
    c.id,
    c.linked_user_id,
    c.full_name,
    c.email,
    c.phone,
    c.address,
    c.category,
    c.solar_requirement,
    c.capacity_kw,
    c.lead_status,
    c.assigned_to,
    c.notes,
    c.is_archived,
    c.created_at,
    c.updated_at,
    sales.full_name AS assigned_sales_name,
    (
      SELECT f.due_at
      FROM customer_follow_ups f
      WHERE f.customer_id = c.id AND f.completed_at IS NULL
      ORDER BY f.due_at
      LIMIT 1
    ) AS next_follow_up_at
  FROM customers c
  LEFT JOIN users sales ON sales.id = c.assigned_to
`

function customerSelect(actor) {
  const salesFollowUpFilter = actor?.role === 'SALES' ? ' AND f.assigned_to = ?' : ''
  return CUSTOMER_SELECT.replace(
    'WHERE f.customer_id = c.id AND f.completed_at IS NULL',
    `WHERE f.customer_id = c.id AND f.completed_at IS NULL${salesFollowUpFilter}`,
  )
}

function toStaffCustomer(customer) {
  return {
    id: customer.id,
    isLinked: Boolean(customer.linked_user_id),
    fullName: customer.full_name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    category: customer.category,
    solarRequirement: customer.solar_requirement,
    capacityKw: customer.capacity_kw,
    leadStatus: customer.lead_status,
    assignedTo: customer.assigned_to,
    assignedSalesName: customer.assigned_sales_name ?? null,
    notes: customer.notes,
    nextFollowUpAt: customer.next_follow_up_at ?? null,
    isArchived: Boolean(customer.is_archived),
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  }
}

function toPortalCustomer(customer) {
  return {
    id: customer.id,
    fullName: customer.full_name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    category: customer.category,
    solarRequirement: customer.solar_requirement,
    capacityKw: customer.capacity_kw,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  }
}

function findCustomerById(database, customerId, actor) {
  const values = actor?.role === 'SALES' ? [actor.id, customerId] : [customerId]
  return database.prepare(`${customerSelect(actor)} WHERE c.id = ?`).get(...values)
}

function findCustomerByUserId(database, userId) {
  return database.prepare(`${CUSTOMER_SELECT} WHERE c.linked_user_id = ?`).get(userId)
}

function findCustomerByEmail(database, email) {
  return database.prepare(`${CUSTOMER_SELECT} WHERE c.email = ?`).get(email)
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function assertUniqueError(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw new HttpError(409, 'CUSTOMER_EMAIL_ALREADY_EXISTS', 'A customer with this email already exists')
  }
  throw error
}

function validateAssignment(database, assignedTo, { allowAdmin = false } = {}) {
  if (assignedTo === null || assignedTo === undefined) return

  const assignee = database.prepare(`
    SELECT id, role, is_active FROM users WHERE id = ?
  `).get(assignedTo)
  const permittedRoles = allowAdmin ? ['ADMIN', 'SALES'] : ['SALES']
  if (!assignee || !assignee.is_active || !permittedRoles.includes(assignee.role)) {
    throw new HttpError(400, 'INVALID_SALES_ASSIGNMENT', 'Assignment must reference an active Sales account')
  }
}

function assertCanManage(actor, customer) {
  if (actor.role === 'ADMIN') return
  if (actor.role === 'SALES') {
    if (!customer.assigned_to || customer.assigned_to === actor.id) return
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  if (actor.role === 'CUSTOMER' && customer.linked_user_id === actor.id) return
  if (actor.role === 'CUSTOMER') {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to access this customer')
}

function createCustomerRecord(database, fields, { linkedUserId = null, assignedTo = null } = {}) {
  const id = randomUUID()
  database.prepare(`
    INSERT INTO customers (
      id, linked_user_id, full_name, email, phone, address, category,
      solar_requirement, capacity_kw, lead_status, assigned_to, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    linkedUserId,
    fields.fullName.trim(),
    fields.email ? normalizeEmail(fields.email) : null,
    fields.phone?.trim() || null,
    fields.address?.trim() || null,
    fields.category ?? null,
    fields.solarRequirement ?? null,
    fields.capacityKw ?? null,
    fields.leadStatus || 'New',
    assignedTo ?? fields.assignedTo ?? null,
    fields.notes?.trim() || '',
  )
  return findCustomerById(database, id)
}

export function listSalesUsers(database) {
  return database.prepare(`
    SELECT id, full_name, email
    FROM users
    WHERE role = 'SALES' AND is_active = 1
    ORDER BY full_name COLLATE NOCASE
  `).all().map((user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
  }))
}

export function listCustomers(database, actor, { search = '', leadStatus, includeArchived = false } = {}) {
  const conditions = []
  const values = []

  if (!includeArchived || actor.role !== 'ADMIN') {
    conditions.push('c.is_archived = 0')
  }
  if (actor.role === 'SALES') {
    conditions.push('(c.assigned_to IS NULL OR c.assigned_to = ?)')
    values.push(actor.id)
  }
  if (leadStatus) {
    conditions.push('c.lead_status = ?')
    values.push(leadStatus)
  }
  if (search.trim()) {
    conditions.push(`instr(lower(
      coalesce(c.full_name, '') || ' ' || coalesce(c.email, '') || ' ' ||
      coalesce(c.phone, '') || ' ' || coalesce(c.address, '') || ' ' ||
      coalesce(c.category, '') || ' ' || coalesce(c.lead_status, '')
    ), lower(?)) > 0`)
    values.push(search.trim().slice(0, 100))
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const selectValues = actor.role === 'SALES' ? [actor.id, ...values] : values
  const customers = database.prepare(`
    ${customerSelect(actor)}
    ${where}
    ORDER BY c.updated_at DESC, c.full_name COLLATE NOCASE
  `).all(...selectValues)

  return customers.map(toStaffCustomer)
}

export function getCustomerForActor(database, customerId, actor) {
  const customer = findCustomerById(database, customerId, actor)
  if (!customer || (customer.is_archived && actor.role !== 'ADMIN')) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  assertCanManage(actor, customer)
  return actor.role === 'CUSTOMER' ? toPortalCustomer(customer) : toStaffCustomer(customer)
}

export function getCustomerForUser(database, userId) {
  const customer = findCustomerByUserId(database, userId)
  if (!customer || customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer profile not found')
  }
  return toPortalCustomer(customer)
}

export function createCustomer(database, fields, actor) {
  let assignedTo = fields.assignedTo ?? null
  if (actor.role === 'SALES') {
    if (assignedTo && assignedTo !== actor.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Sales users may only assign leads to themselves')
    }
    assignedTo = actor.id
  }
  validateAssignment(database, assignedTo)

  try {
    return toStaffCustomer(createCustomerRecord(database, fields, { assignedTo }))
  } catch (error) {
    assertUniqueError(error)
  }
}

function updateLinkedUser(database, customer, fields) {
  if (!customer.linked_user_id) return
  const currentUser = database.prepare(`
    SELECT id, full_name, email, phone, address
    FROM users WHERE id = ?
  `).get(customer.linked_user_id)
  const fullName = fields.fullName ?? currentUser.full_name
  const email = fields.email ? normalizeEmail(fields.email) : currentUser.email
  const phone = fields.phone ?? currentUser.phone
  const address = fields.address ?? currentUser.address

  const conflictingUser = findUserByEmail(database, email)
  if (conflictingUser && conflictingUser.id !== currentUser.id) {
    throw new HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists')
  }

  database.prepare(`
    UPDATE users
    SET full_name = ?, email = ?, phone = ?, address = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(fullName.trim(), email, phone ?? null, address ?? null, currentUser.id)
}

export function updateCustomer(database, customerId, fields, actor) {
  const customer = findCustomerById(database, customerId, actor)
  if (!customer || customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  assertCanManage(actor, customer)

  const assignedTo = fields.assignedTo === undefined ? customer.assigned_to : fields.assignedTo
  if (actor.role === 'SALES') {
    if (fields.assignedTo !== undefined && fields.assignedTo !== actor.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Sales users may only assign leads to themselves')
    }
    validateAssignment(database, actor.id)
  } else {
    validateAssignment(database, assignedTo)
  }

  const next = {
    fullName: fields.fullName ?? customer.full_name,
    email: fields.email ? normalizeEmail(fields.email) : customer.email,
    phone: fields.phone ?? customer.phone,
    address: fields.address ?? customer.address,
    category: fields.category ?? customer.category,
    solarRequirement: fields.solarRequirement ?? customer.solar_requirement,
    capacityKw: fields.capacityKw === undefined ? customer.capacity_kw : fields.capacityKw,
    leadStatus: fields.leadStatus ?? customer.lead_status,
    assignedTo: actor.role === 'SALES' ? actor.id : assignedTo,
    notes: fields.notes ?? customer.notes,
  }

  try {
    return database.transaction(() => {
      updateLinkedUser(database, customer, fields)
      database.prepare(`
        UPDATE customers
        SET full_name = ?, email = ?, phone = ?, address = ?, category = ?,
            solar_requirement = ?, capacity_kw = ?, lead_status = ?, assigned_to = ?,
            notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(
        next.fullName.trim(),
        next.email,
        next.phone ?? null,
        next.address ?? null,
        next.category,
        next.solarRequirement,
        next.capacityKw,
        next.leadStatus,
        next.assignedTo,
        next.notes.trim(),
        customerId,
      )
      const updatedCustomer = findCustomerById(database, customerId, actor)
      return actor.role === 'CUSTOMER' ? toPortalCustomer(updatedCustomer) : toStaffCustomer(updatedCustomer)
    })()
  } catch (error) {
    assertUniqueError(error)
  }
}

export function archiveCustomer(database, customerId) {
  const customer = findCustomerById(database, customerId)
  if (!customer || customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  if (customer.linked_user_id) {
    throw new HttpError(409, 'CUSTOMER_ACCOUNT_LINKED', 'Linked customer accounts cannot be archived')
  }

  database.prepare(`
    UPDATE customers
    SET is_archived = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(customerId)
}

export async function registerCustomerAccount(database, fields) {
  const preparedUser = await prepareUser(database, {
    ...fields,
    role: 'CUSTOMER',
  })

  try {
    return database.transaction(() => {
      const user = insertPreparedUser(database, preparedUser)
      const existingCustomer = findCustomerByEmail(database, preparedUser.email)
      if (existingCustomer?.linked_user_id || existingCustomer?.is_archived) {
        throw new HttpError(409, 'CUSTOMER_EMAIL_ALREADY_EXISTS', 'A customer with this email already exists')
      }

      let customer
      if (existingCustomer) {
        database.prepare(`
          UPDATE customers
          SET linked_user_id = ?, full_name = ?, phone = ?, address = ?, category = ?,
              solar_requirement = ?, capacity_kw = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `).run(
          user.id,
          fields.fullName.trim(),
          fields.phone.trim(),
          fields.address.trim(),
          fields.category,
          fields.solarRequirement,
          fields.capacityKw ?? null,
          existingCustomer.id,
        )
        customer = findCustomerById(database, existingCustomer.id)
      } else {
        customer = createCustomerRecord(database, fields, { linkedUserId: user.id })
      }

      return { user, customer: toPortalCustomer(customer) }
    })()
  } catch (error) {
    assertUniqueError(error)
  }
}

export function listFollowUps(database, customerId, actor) {
  const customer = findCustomerById(database, customerId)
  if (!customer || customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  assertCanManage(actor, customer)

  const salesFilter = actor.role === 'SALES' ? 'AND f.assigned_to = ?' : ''
  const values = actor.role === 'SALES' ? [customerId, actor.id] : [customerId]
  return database.prepare(`
    SELECT f.id, f.customer_id, f.assigned_to, f.created_by, f.due_at, f.note,
           f.completed_at, f.created_at, f.updated_at,
           assigned.full_name AS assigned_name,
           creator.full_name AS created_by_name
    FROM customer_follow_ups f
    JOIN users assigned ON assigned.id = f.assigned_to
    LEFT JOIN users creator ON creator.id = f.created_by
    WHERE f.customer_id = ? ${salesFilter}
    ORDER BY f.completed_at IS NOT NULL, f.due_at
  `).all(...values).map(toFollowUp)
}

function toFollowUp(followUp) {
  return {
    id: followUp.id,
    customerId: followUp.customer_id,
    assignedTo: followUp.assigned_to,
    assignedToName: followUp.assigned_name,
    createdBy: followUp.created_by,
    createdByName: followUp.created_by_name,
    dueAt: followUp.due_at,
    note: followUp.note,
    completedAt: followUp.completed_at,
    completed: Boolean(followUp.completed_at),
    createdAt: followUp.created_at,
    updatedAt: followUp.updated_at,
  }
}

export function createFollowUp(database, customerId, fields, actor) {
  const customer = findCustomerById(database, customerId)
  if (!customer || customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  assertCanManage(actor, customer)

  const assignedTo = fields.assignedTo ?? customer.assigned_to ?? actor.id
  if (actor.role === 'SALES' && assignedTo !== actor.id) {
    throw new HttpError(403, 'FORBIDDEN', 'Sales users may only assign follow-ups to themselves')
  }
  validateAssignment(database, assignedTo, { allowAdmin: true })

  const id = randomUUID()
  return database.transaction(() => {
    if (actor.role === 'SALES' && !customer.assigned_to) {
      database.prepare(`
        UPDATE customers
        SET assigned_to = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(actor.id, customerId)
    }
    database.prepare(`
      INSERT INTO customer_follow_ups (id, customer_id, assigned_to, created_by, due_at, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, customerId, assignedTo, actor.id, new Date(fields.dueAt).toISOString(), fields.note.trim())
    return listFollowUps(database, customerId, actor).find((followUp) => followUp.id === id)
  })()
}

export function updateFollowUp(database, customerId, followUpId, fields, actor) {
  const customer = findCustomerById(database, customerId)
  if (!customer || customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  assertCanManage(actor, customer)
  const followUp = database.prepare(`
    SELECT * FROM customer_follow_ups WHERE id = ? AND customer_id = ?
  `).get(followUpId, customerId)
  if (!followUp) throw new HttpError(404, 'FOLLOW_UP_NOT_FOUND', 'Follow-up not found')
  if (actor.role === 'SALES' && followUp.assigned_to !== actor.id) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only update follow-ups assigned to you')
  }

  const completedAt = fields.completed === undefined
    ? followUp.completed_at
    : fields.completed ? new Date().toISOString() : null
  database.prepare(`
    UPDATE customer_follow_ups
    SET due_at = ?, note = ?, completed_at = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(
    fields.dueAt ? new Date(fields.dueAt).toISOString() : followUp.due_at,
    fields.note ?? followUp.note,
    completedAt,
    followUpId,
  )
  return listFollowUps(database, customerId, actor).find((item) => item.id === followUpId)
}
