import { randomUUID } from 'node:crypto'
import { HttpError } from '../errors.js'

function assertCanAccessLead(lead, actor) {
  if (actor.role === 'ADMIN') return
  if (actor.role === 'SALES' && (!lead.assigned_to || lead.assigned_to === actor.id)) return
  if (actor.role === 'CUSTOMER' && lead.linked_user_id === actor.id) return
  throw new HttpError(404, 'SURVEY_NOT_FOUND', 'Approved survey not found')
}

function quoteDto(quote) {
  return {
    id: quote.id,
    quoteNumber: quote.quote_number,
    leadId: quote.lead_id,
    surveyId: quote.survey_id,
    surveyReference: quote.survey_number,
    customerId: quote.customer_id,
    customerName: quote.customer_name,
    packageTemplateId: quote.package_template_id,
    packageName: quote.package_name,
    status: quote.status,
    version: quote.version,
    totalAmount: quote.total_amount,
    terms: quote.terms,
    responseNotes: quote.response_notes,
    respondedAt: quote.responded_at,
    issuedAt: quote.issued_at,
    createdAt: quote.created_at,
    updatedAt: quote.updated_at,
  }
}

const COMPONENT_PRODUCT_TYPES = {
  PANELS: 'PANEL',
  CONNECTORS: 'CONNECTOR',
  WIRES: 'WIRE',
  INVERTER: 'INVERTER',
  WIRING_BOXES: 'WIRING_BOXES',
  CHARGE_CONTROLLER: 'CHARGE_CONTROLLER',
  SAFETY_EARTHING: 'SAFETY_EARTHING',
  METAL_STANDS: 'METAL_STAND',
  LARGE_BATTERY: 'BATTERY',
  SWITCHES: 'SWITCH',
  SAFETY_PARTS: 'SAFETY_PART',
  INSTALLATION_SERVICE: 'INSTALLATION_SERVICE',
}

const QUOTE_SELECT = `
  SELECT quotation.*,
         survey.survey_number,
         survey.customer_id,
         customer.full_name AS customer_name,
         template.name AS package_name,
         lead.assigned_to AS assigned_to,
         customer.linked_user_id,
         coalesce((SELECT sum(item.quantity * item.unit_price)
                   FROM quotation_items item
                   WHERE item.quotation_id = quotation.id
                     AND item.unit_price IS NOT NULL
                   HAVING count(item.id) = (
                     SELECT count(*) FROM quotation_items priced_item
                     WHERE priced_item.quotation_id = quotation.id
                   )), NULL) AS total_amount
  FROM quotations quotation
  JOIN surveys survey ON survey.id = quotation.survey_id
  JOIN customers customer ON customer.id = survey.customer_id
  JOIN leads lead ON lead.id = quotation.lead_id
  LEFT JOIN package_templates template ON template.id = quotation.package_template_id
`

export function getQuotationOptions(database, actor) {
  const surveys = database.prepare(`
    SELECT survey.id, survey.survey_number, survey.customer_id,
           customer.full_name AS customer_name, customer.solar_requirement,
           customer.capacity_kw, lead.assigned_to
    FROM surveys survey
    JOIN customers customer ON customer.id = survey.customer_id
    JOIN leads lead ON lead.id = survey.lead_id
    WHERE survey.status = 'APPROVED'
    ORDER BY survey.reviewed_at DESC, survey.created_at DESC
  `).all()
    .filter((survey) => {
      try {
        assertCanAccessLead(survey, actor)
        return true
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return false
        throw error
      }
    })
    .map((survey) => ({
      id: survey.id,
      reference: survey.survey_number,
      customerId: survey.customer_id,
      customerName: survey.customer_name,
      systemType: survey.solar_requirement,
      capacityKw: survey.capacity_kw,
    }))
  const packageTemplates = database.prepare(`
    SELECT id, name, system_type
    FROM package_templates
    WHERE is_active = 1
    ORDER BY name COLLATE NOCASE
  `).all().map((template) => ({
    id: template.id,
    name: template.name,
    systemType: template.system_type,
    items: database.prepare(`
      SELECT id, component_code AS componentCode, description, quantity, unit,
             unit_price AS unitPrice
      FROM package_template_items
      WHERE template_id = ?
      ORDER BY sort_order, id
    `).all(template.id),
  }))
  return { surveys, packageTemplates }
}

export function listQuotations(database, actor) {
  const quotes = database.prepare(`
    ${QUOTE_SELECT}
    ORDER BY quotation.created_at DESC, quotation.id
  `).all()
  return quotes
    .filter((quote) => {
      try {
        assertCanAccessLead(quote, actor)
        return true
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return false
        throw error
      }
    })
    .map(quoteDto)
}

export function createQuotation(database, fields, actor) {
  const survey = database.prepare(`
    SELECT survey.id, survey.survey_number, survey.lead_id, survey.customer_id,
           survey.status, lead.assigned_to
    FROM surveys survey
    JOIN leads lead ON lead.id = survey.lead_id
    WHERE survey.id = ?
  `).get(fields.surveyId)
  if (!survey) throw new HttpError(404, 'SURVEY_NOT_FOUND', 'Survey not found')
  assertCanAccessLead(survey, actor)

  if (fields.packageTemplateId) {
    const template = database.prepare(`
      SELECT id, system_type FROM package_templates WHERE id = ? AND is_active = 1
    `).get(fields.packageTemplateId)
    if (!template) {
      throw new HttpError(400, 'INVALID_PACKAGE_TEMPLATE', 'Select an active package template')
    }
    const expectedType = database.prepare(`
      SELECT solar_requirement FROM customers WHERE id = ?
    `).get(survey.customer_id)?.solar_requirement
    const expectedTemplateType = expectedType === 'Off-Grid System' ? 'OFF_GRID'
      : expectedType === 'On-Grid System' ? 'ON_GRID'
        : null
    if (expectedTemplateType && template.system_type !== expectedTemplateType) {
      throw new HttpError(400, 'PACKAGE_TEMPLATE_MISMATCH', 'Package template must match the customer system preference')
    }
  }

  const quoteId = randomUUID()
  const quoteNumber = `QT-${randomUUID().slice(0, 8).toUpperCase()}`
  const templateItems = fields.packageTemplateId
    ? database.prepare(`
      SELECT id, component_code, description, quantity, unit, sort_order, unit_price
      FROM package_template_items
      WHERE template_id = ?
      ORDER BY sort_order, id
    `).all(fields.packageTemplateId)
    : []
  const suppliedItems = fields.items || []
  let items = suppliedItems
  if (templateItems.length) {
    const itemById = new Map(templateItems.map((item) => [item.id, item]))
    if (suppliedItems.length) {
      if (
        suppliedItems.some((item) => !item.templateItemId || !itemById.has(item.templateItemId))
        || new Set(suppliedItems.map((item) => item.templateItemId)).size !== templateItems.length
        || suppliedItems.length !== templateItems.length
      ) {
        throw new HttpError(400, 'INCOMPLETE_BOM', 'Provide a quantity for every configured package component')
      }
      items = suppliedItems.map((item) => ({
        ...item,
        description: itemById.get(item.templateItemId).description,
        unit: item.unit || itemById.get(item.templateItemId).unit,
        unitPrice: item.unitPrice ?? itemById.get(item.templateItemId).unit_price,
        productType: COMPONENT_PRODUCT_TYPES[itemById.get(item.templateItemId).component_code],
      }))
    } else if (templateItems.every((item) => item.quantity !== null)) {
      items = templateItems.map((item) => ({
        templateItemId: item.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
        productType: COMPONENT_PRODUCT_TYPES[item.component_code],
      }))
    } else {
      throw new HttpError(400, 'BOM_QUANTITIES_REQUIRED', 'Enter site-specific quantities for the configured package components')
    }
  }

  const create = database.transaction(() => {
    database.prepare(`
      INSERT INTO quotations (
        id, quote_number, lead_id, survey_id, package_template_id, status, terms, created_by
      ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?)
    `).run(
      quoteId,
      quoteNumber,
      survey.lead_id,
      survey.id,
      fields.packageTemplateId ?? null,
      fields.terms.trim(),
      actor.id,
    )
    insertQuotationItems(database, quoteId, items)
    recordRevision(database, quoteId, actor.id)
  })
  create()
  return quoteDto(database.prepare(`${QUOTE_SELECT} WHERE quotation.id = ?`).get(quoteId))
}

function insertQuotationItems(database, quotationId, items) {
  const insert = database.prepare(`
    INSERT INTO quotation_items (
      id, quotation_id, template_item_id, description, quantity, unit, unit_price, sort_order, product_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  items.forEach((item, index) => {
    insert.run(
      randomUUID(),
      quotationId,
      item.templateItemId ?? null,
      item.description.trim(),
      item.quantity,
      item.unit,
      item.unitPrice ?? null,
      index + 1,
      item.productType ?? null,
    )
  })
}

function recordRevision(database, quotationId, actorId) {
  const quote = database.prepare(`
    SELECT id, quote_number, survey_id, package_template_id, status, terms, version
    FROM quotations WHERE id = ?
  `).get(quotationId)
  const items = database.prepare(`
    SELECT template_item_id, description, quantity, unit, unit_price, sort_order, product_type
    FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order
  `).all(quotationId)
  database.prepare(`
    INSERT INTO quotation_revisions (id, quotation_id, version, snapshot_json, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), quotationId, quote.version, JSON.stringify({ ...quote, items }), actorId)
}

export function updateQuotationItems(database, quoteId, fields, actor) {
  const quote = database.prepare(`
    ${QUOTE_SELECT}
    WHERE quotation.id = ?
  `).get(quoteId)
  if (!quote) throw new HttpError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found')
  assertCanAccessLead(quote, actor)
  if (quote.status !== 'DRAFT') {
    throw new HttpError(409, 'QUOTATION_NOT_EDITABLE', 'Only a draft quotation can be edited')
  }

  const replace = database.transaction(() => {
    database.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quoteId)
    insertQuotationItems(database, quoteId, fields.items)
    database.prepare(`
      UPDATE quotations
      SET version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(quoteId)
    recordRevision(database, quoteId, actor.id)
  })
  replace()
  return getQuotation(database, quoteId, actor)
}

export function getQuotation(database, quoteId, actor) {
  const quote = database.prepare(`${QUOTE_SELECT} WHERE quotation.id = ?`).get(quoteId)
  if (!quote) throw new HttpError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found')
  assertCanAccessLead(quote, actor)
  return {
    ...quoteDto(quote),
    items: database.prepare(`
      SELECT id, template_item_id AS templateItemId, description, product_type AS productType,
             quantity, unit, unit_price AS unitPrice, sort_order AS sortOrder
      FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order
    `).all(quoteId),
    revisions: database.prepare(`
      SELECT version, created_at AS createdAt
      FROM quotation_revisions WHERE quotation_id = ? ORDER BY version
    `).all(quoteId),
  }
}

export function respondToQuotation(database, quoteId, fields, actor) {
  if (actor.role !== 'CUSTOMER') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the customer can respond to this quotation')
  }
  const quote = database.prepare(`${QUOTE_SELECT} WHERE quotation.id = ?`).get(quoteId)
  if (!quote) throw new HttpError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found')
  assertCanAccessLead(quote, actor)
  if (quote.status !== 'RELEASED') {
    throw new HttpError(409, 'QUOTATION_NOT_RESPONDABLE', 'Only a released quotation can be accepted or rejected')
  }
  database.prepare(`
    UPDATE quotations
    SET status = ?, responded_by = ?, responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        response_notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(fields.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', actor.id, fields.comments, quoteId)
  return getQuotation(database, quoteId, actor)
}

export function updatePackageTemplate(database, templateId, fields, actor) {
  if (actor.role !== 'ADMIN') {
    throw new HttpError(403, 'FORBIDDEN', 'Only Admin can configure package templates')
  }
  const template = database.prepare(`
    SELECT id, system_type FROM package_templates WHERE id = ?
  `).get(templateId)
  if (!template) throw new HttpError(404, 'PACKAGE_TEMPLATE_NOT_FOUND', 'Package template not found')
  const save = database.transaction(() => {
    database.prepare('UPDATE package_templates SET is_active = 0 WHERE id = ?').run(templateId)
    database.prepare('DELETE FROM package_template_items WHERE template_id = ?').run(templateId)
    const insertItem = database.prepare(`
      INSERT INTO package_template_items (
        id, template_id, component_code, description, quantity, unit, sort_order, unit_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    fields.items.forEach((item, index) => {
      insertItem.run(
        randomUUID(),
        templateId,
        item.componentCode,
        item.description,
        item.quantity ?? null,
        item.unit,
        index + 1,
        item.unitPrice ?? null,
      )
    })
    database.prepare(`
      UPDATE package_templates
      SET name = ?, description = ?, is_active = 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(fields.name, fields.description, templateId)
  })
  try {
    save()
  } catch (error) {
    if (String(error.message).includes('missing one or more required BOM components')) {
      throw new HttpError(400, 'INCOMPLETE_PACKAGE_BOM', 'The template is missing one or more required official components')
    }
    throw error
  }
  return database.prepare(`
    SELECT template.id, template.name, template.system_type AS systemType,
           template.description, template.is_active AS isActive,
           item.id AS itemId, item.component_code AS componentCode,
           item.description AS itemDescription, item.quantity, item.unit,
           item.unit_price AS unitPrice, item.sort_order AS sortOrder
    FROM package_templates template
    LEFT JOIN package_template_items item ON item.template_id = template.id
    WHERE template.id = ?
    ORDER BY item.sort_order
  `).all(templateId)
}

export function updateQuotationStatus(database, quoteId, status, actor) {
  const quote = database.prepare(`
    ${QUOTE_SELECT}
    WHERE quotation.id = ?
  `).get(quoteId)
  if (!quote) throw new HttpError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found')
  assertCanAccessLead(quote, actor)
  if (status === 'RELEASED' && quote.status !== 'RELEASED') {
    const survey = database.prepare('SELECT status FROM surveys WHERE id = ?').get(quote.survey_id)
    if (survey.status !== 'APPROVED') {
      throw new HttpError(409, 'SURVEY_APPROVAL_REQUIRED', 'An approved survey is required before a quotation can be released')
    }
    if (quote.status === 'RELEASED' && status !== 'RELEASED') {
      throw new HttpError(409, 'QUOTATION_NOT_EDITABLE', 'A released quotation cannot be moved back to an earlier status')
    }
  }
  if (!['DRAFT', 'PENDING', 'RELEASED'].includes(quote.status)) {
    throw new HttpError(409, 'QUOTATION_NOT_EDITABLE', 'Quotation cannot be updated in its current status')
  }

  try {
    database.prepare(`
      UPDATE quotations
      SET status = ?,
          issued_at = CASE WHEN ? = 'RELEASED' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE issued_at END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(status, status, quoteId)
  } catch (error) {
    if (String(error.message).toLowerCase().includes('quotation cannot be released before its survey is approved')) {
      throw new HttpError(409, 'SURVEY_APPROVAL_REQUIRED', 'An approved survey is required before a quotation can be released')
    }
    throw error
  }
  return quoteDto(database.prepare(`${QUOTE_SELECT} WHERE quotation.id = ?`).get(quoteId))
}
