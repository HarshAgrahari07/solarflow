import { createHash, randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { HttpError } from '../errors.js'
import { resolveManagedFilePath, writeManagedFile } from './fileStorage.js'

const SURVEY_SELECT = `
  SELECT survey.*,
         customer.full_name AS customer_name,
         customer.email AS customer_email,
         customer.phone AS customer_phone,
         customer.category AS customer_category,
         customer.solar_requirement,
         customer.capacity_kw,
         customer.linked_user_id,
         lead.assigned_to AS lead_assigned_to,
         surveyor.full_name AS surveyor_name,
         surveyor.email AS surveyor_email,
         creator.full_name AS creator_name,
         (
           SELECT review_action FROM survey_approvals approval
           WHERE approval.survey_id = survey.id
           ORDER BY approval.decided_at DESC, approval.id DESC
           LIMIT 1
         ) AS latest_review_action
  FROM surveys survey
  JOIN leads lead ON lead.id = survey.lead_id
  JOIN customers customer ON customer.id = lead.customer_id
  LEFT JOIN users surveyor ON surveyor.id = survey.assigned_surveyor_id
  LEFT JOIN users creator ON creator.id = survey.created_by
`

const SURVEY_FIELD_COLUMNS = {
  shadowFreeRoofAreaSqm: 'shadow_free_roof_area_sqm',
  monthlyElectricityBillInr: 'monthly_electricity_bill',
  gridSuitability: 'grid_suitability',
  customerRequirements: 'customer_requirements',
  preliminaryObservations: 'preliminary_observations',
  roofDirection: 'roof_direction',
  roofTiltDegrees: 'roof_tilt_degrees',
  cableDistanceMeters: 'cable_distance_meters',
  actualAvailableRoofAreaSqm: 'actual_available_roof_area_sqm',
  siteCondition: 'site_condition',
  shadeObservations: 'shade_observations',
  technicalNotes: 'technical_notes',
}

function workflowStatus(survey) {
  if (survey.visit_status === 'CANCELLED') return 'CANCELLED'
  if (survey.status === 'REJECTED' && survey.latest_review_action === 'REQUEST_CORRECTIONS') {
    return 'CHANGES_REQUESTED'
  }
  if (survey.status === 'DRAFT' && survey.visit_status === 'SCHEDULED') return 'SCHEDULED'
  if (survey.status === 'DRAFT' && survey.visit_status === 'IN_PROGRESS') return 'IN_PROGRESS'
  return survey.status
}

function photoDto(photo) {
  return {
    id: photo.id,
    fileId: photo.file_id,
    originalName: photo.original_name,
    mediaType: photo.media_type,
    byteSize: photo.byte_size,
    attachmentType: photo.attachment_type,
    uploadedBy: photo.uploaded_by,
    uploadedByName: photo.uploaded_by_name,
    createdAt: photo.created_at,
    url: `/api/surveys/${encodeURIComponent(photo.survey_id)}/photos/${encodeURIComponent(photo.id)}`,
  }
}

function surveyDto(survey) {
  return {
    id: survey.id,
    reference: survey.survey_number,
    customerId: survey.customer_id,
    customerName: survey.customer_name,
    customerEmail: survey.customer_email,
    customerPhone: survey.customer_phone,
    customerCategory: survey.customer_category,
    customerSolarRequirement: survey.solar_requirement,
    customerCapacityKw: survey.capacity_kw,
    siteAddress: survey.site_address,
    leadId: survey.lead_id,
    assignedSurveyorId: survey.assigned_surveyor_id,
    assignedSurveyorName: survey.surveyor_name,
    assignedSurveyorEmail: survey.surveyor_email,
    scheduledAt: survey.scheduled_at,
    visitStatus: survey.visit_status,
    status: workflowStatus(survey),
    customerRequirements: survey.customer_requirements,
    preliminaryObservations: survey.preliminary_observations,
    shadowFreeRoofAreaSqm: survey.shadow_free_roof_area_sqm,
    monthlyElectricityBillInr: survey.monthly_electricity_bill,
    gridSuitability: survey.grid_suitability,
    roofDirection: survey.roof_direction,
    roofTiltDegrees: survey.roof_tilt_degrees,
    cableDistanceMeters: survey.cable_distance_meters,
    actualAvailableRoofAreaSqm: survey.actual_available_roof_area_sqm,
    siteCondition: survey.site_condition,
    shadeObservations: survey.shade_observations,
    technicalNotes: survey.technical_notes,
    submittedAt: survey.submitted_at,
    submittedBy: survey.submitted_by,
    createdBy: survey.created_by,
    createdByName: survey.creator_name,
    reviewedAt: survey.reviewed_at,
    createdAt: survey.created_at,
    updatedAt: survey.updated_at,
  }
}

function customerSurveyDto(survey) {
  const details = surveyDto(survey)
  return {
    id: details.id,
    reference: details.reference,
    customerId: details.customerId,
    siteAddress: details.siteAddress,
    scheduledAt: details.scheduledAt,
    visitStatus: details.visitStatus,
    status: details.status,
    createdAt: details.createdAt,
    updatedAt: details.updatedAt,
  }
}

function findSurvey(database, surveyId) {
  return database.prepare(`${SURVEY_SELECT} WHERE survey.id = ?`).get(surveyId)
}

function assertCanViewSurvey(survey, actor) {
  if (actor.role === 'ADMIN') return
  if (actor.role === 'SALES') {
    if (!survey.lead_assigned_to || survey.lead_assigned_to === actor.id) return
  } else if (actor.role === 'SURVEYOR') {
    if (survey.assigned_surveyor_id === actor.id) return
  } else if (actor.role === 'CUSTOMER') {
    if (survey.linked_user_id === actor.id) return
  }
  throw new HttpError(404, 'SURVEY_NOT_FOUND', 'Survey not found')
}

function getAuthorizedSurvey(database, surveyId, actor) {
  const survey = findSurvey(database, surveyId)
  if (!survey) throw new HttpError(404, 'SURVEY_NOT_FOUND', 'Survey not found')
  assertCanViewSurvey(survey, actor)
  return survey
}

function publicPhotoList(database, surveyId) {
  return database.prepare(`
    SELECT attachment.id, attachment.survey_id, attachment.file_id,
           attachment.attachment_type, attachment.created_at,
           file.original_name, file.media_type, file.byte_size, file.uploaded_by,
           uploader.full_name AS uploaded_by_name
    FROM survey_attachments attachment
    JOIN stored_files file ON file.id = attachment.file_id
    LEFT JOIN users uploader ON uploader.id = file.uploaded_by
    WHERE attachment.survey_id = ?
    ORDER BY attachment.created_at, attachment.id
  `).all(surveyId).map(photoDto)
}

export function listSurveyors(database) {
  return database.prepare(`
    SELECT id, full_name, email
    FROM users
    WHERE role = 'SURVEYOR' AND is_active = 1
    ORDER BY full_name COLLATE NOCASE
  `).all().map((surveyor) => ({
    id: surveyor.id,
    fullName: surveyor.full_name,
    email: surveyor.email,
  }))
}

export function listSurveys(database, actor, { status, search = '' } = {}) {
  const conditions = []
  const values = []

  if (actor.role === 'SALES') {
    conditions.push('(lead.assigned_to IS NULL OR lead.assigned_to = ?)')
    values.push(actor.id)
  } else if (actor.role === 'SURVEYOR') {
    conditions.push('survey.assigned_surveyor_id = ?')
    values.push(actor.id)
  } else if (actor.role === 'CUSTOMER') {
    conditions.push('customer.linked_user_id = ?')
    values.push(actor.id)
  }

  if (status === 'SCHEDULED') {
    conditions.push("survey.status = 'DRAFT' AND survey.visit_status = 'SCHEDULED'")
  } else if (status === 'IN_PROGRESS') {
    conditions.push("survey.status = 'DRAFT' AND survey.visit_status = 'IN_PROGRESS'")
  } else if (status === 'CHANGES_REQUESTED') {
    conditions.push(`
      survey.status = 'REJECTED'
      AND (SELECT review_action FROM survey_approvals approval
           WHERE approval.survey_id = survey.id
           ORDER BY approval.decided_at DESC, approval.id DESC LIMIT 1) = 'REQUEST_CORRECTIONS'
    `)
  } else if (status === 'CANCELLED') {
    conditions.push("survey.visit_status = 'CANCELLED'")
  } else if (status) {
    conditions.push('survey.status = ?')
    values.push(status)
  }

  if (search) {
    conditions.push(`instr(lower(
      survey.survey_number || ' ' || customer.full_name || ' ' ||
      survey.site_address || ' ' || coalesce(surveyor.full_name, '')
    ), lower(?)) > 0`)
    values.push(search)
  }

  const rows = database.prepare(`
    ${SURVEY_SELECT}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY survey.scheduled_at IS NULL, survey.scheduled_at, survey.created_at DESC
  `).all(...values)

  return rows.map(actor.role === 'CUSTOMER' ? customerSurveyDto : surveyDto)
}

export function getSurvey(database, surveyId, actor) {
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (actor.role === 'CUSTOMER') return customerSurveyDto(survey)
  const details = {
    ...surveyDto(survey),
    photos: publicPhotoList(database, surveyId),
    approvalHistory: database.prepare(`
      SELECT approval.id, approval.reviewer_user_id, reviewer.full_name AS reviewer_name,
             approval.decision, approval.review_action, approval.notes, approval.decided_at
      FROM survey_approvals approval
      LEFT JOIN users reviewer ON reviewer.id = approval.reviewer_user_id
      WHERE approval.survey_id = ?
      ORDER BY approval.decided_at, approval.id
    `).all(surveyId).map((approval) => ({
      id: approval.id,
      reviewerId: approval.reviewer_user_id,
      reviewerName: approval.reviewer_name,
      decision: approval.review_action === 'LEGACY' ? approval.decision : approval.review_action,
      comments: approval.notes,
      decidedAt: approval.decided_at,
    })),
  }
  return details
}

function assertCanScheduleCustomer(customer, actor) {
  if (customer.is_archived) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
  if (actor.role === 'SALES' && customer.assigned_to && customer.assigned_to !== actor.id) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
  }
}

function validateSurveyor(database, surveyorId) {
  const surveyor = database.prepare(`
    SELECT id FROM users
    WHERE id = ? AND role = 'SURVEYOR' AND is_active = 1
  `).get(surveyorId)
  if (!surveyor) {
    throw new HttpError(400, 'INVALID_SURVEYOR_ASSIGNMENT', 'Assign an active Surveyor account')
  }
}

export function createSurvey(database, fields, actor) {
  const customer = database.prepare(`
    SELECT customer.id, customer.address, customer.assigned_to, customer.is_archived, lead.id AS lead_id
    FROM customers customer
    LEFT JOIN leads lead ON lead.customer_id = customer.id
    WHERE customer.id = ?
  `).get(fields.customerId)
  if (!customer || !customer.lead_id) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer or its lead record was not found')
  }
  assertCanScheduleCustomer(customer, actor)
  validateSurveyor(database, fields.assignedSurveyorId)

  const surveyId = randomUUID()
  const surveyNumber = `SRV-${randomUUID().slice(0, 8).toUpperCase()}`
  database.prepare(`
    INSERT INTO surveys (
      id, survey_number, lead_id, customer_id, site_address,
      assigned_surveyor_id, scheduled_at, visit_status, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 'DRAFT', ?)
  `).run(
    surveyId,
    surveyNumber,
    customer.lead_id,
    fields.customerId,
    fields.siteAddress.trim(),
    fields.assignedSurveyorId,
    new Date(fields.scheduledAt).toISOString(),
    actor.id,
  )
  return getSurvey(database, surveyId, actor)
}

export function updateSurveySchedule(database, surveyId, fields, actor) {
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (!['ADMIN', 'SALES'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Only Admin or Sales can reschedule a survey')
  }
  if (['APPROVED', 'CANCELLED'].includes(survey.status) || survey.visit_status === 'CANCELLED') {
    throw new HttpError(409, 'SURVEY_NOT_RESCHEDULABLE', 'Approved or cancelled surveys cannot be rescheduled')
  }
  if (fields.assignedSurveyorId !== undefined) validateSurveyor(database, fields.assignedSurveyorId)

  const columns = []
  const values = []
  if (fields.assignedSurveyorId !== undefined) {
    columns.push('assigned_surveyor_id = ?')
    values.push(fields.assignedSurveyorId)
  }
  if (fields.scheduledAt !== undefined) {
    columns.push('scheduled_at = ?')
    values.push(new Date(fields.scheduledAt).toISOString())
    if (survey.visit_status === 'CANCELLED') {
      columns.push("visit_status = 'SCHEDULED'")
    }
  }
  if (fields.siteAddress !== undefined) {
    columns.push('site_address = ?')
    values.push(fields.siteAddress.trim())
  }
  columns.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  database.prepare(`UPDATE surveys SET ${columns.join(', ')} WHERE id = ?`)
    .run(...values, surveyId)
  return getSurvey(database, surveyId, actor)
}

export function updateSurveyVisitStatus(database, surveyId, status, actor) {
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (status === 'CANCELLED') {
    if (!['ADMIN', 'SALES'].includes(actor.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'Only Admin or Sales can cancel a survey')
    }
    if (['APPROVED', 'PENDING_APPROVAL'].includes(survey.status)) {
      throw new HttpError(409, 'SURVEY_NOT_CANCELLABLE', 'Submitted or approved surveys cannot be cancelled')
    }
  } else if (status === 'IN_PROGRESS') {
    if (actor.role !== 'SURVEYOR' || survey.assigned_surveyor_id !== actor.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the assigned Surveyor can start a site visit')
    }
    if (!['DRAFT', 'REJECTED'].includes(survey.status)) {
      throw new HttpError(409, 'SURVEY_NOT_STARTABLE', 'Survey cannot be started in the current status')
    }
  } else {
    throw new HttpError(400, 'INVALID_VISIT_STATUS', 'Use the supported survey visit status')
  }
  database.prepare(`
    UPDATE surveys
    SET visit_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(status, surveyId)
  return getSurvey(database, surveyId, actor)
}

export function updateSurveyDraft(database, surveyId, fields, actor) {
  if (actor.role !== 'SURVEYOR') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the assigned Surveyor can update survey findings')
  }
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (!['DRAFT', 'REJECTED'].includes(survey.status)) {
    throw new HttpError(409, 'SURVEY_NOT_EDITABLE', 'Survey findings cannot be changed in the current status')
  }
  const assignments = []
  const values = []
  for (const [field, column] of Object.entries(SURVEY_FIELD_COLUMNS)) {
    if (fields[field] === undefined) continue
    assignments.push(`${column} = ?`)
    values.push(typeof fields[field] === 'string' ? fields[field].trim() : fields[field])
  }
  assignments.push("visit_status = 'IN_PROGRESS'")
  assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  database.prepare(`UPDATE surveys SET ${assignments.join(', ')} WHERE id = ?`)
    .run(...values, surveyId)
  return getSurvey(database, surveyId, actor)
}

const SUBMISSION_REQUIRED_FIELDS = [
  ['shadow_free_roof_area_sqm', 'Shadow-free roof area'],
  ['monthly_electricity_bill', 'Monthly electricity bill'],
  ['grid_suitability', 'Grid suitability'],
  ['customer_requirements', 'Customer requirements'],
  ['preliminary_observations', 'Preliminary observations'],
  ['roof_direction', 'Roof direction'],
  ['roof_tilt_degrees', 'Roof tilt'],
  ['cable_distance_meters', 'Cable distance'],
  ['actual_available_roof_area_sqm', 'Actual available roof area'],
  ['site_condition', 'Site condition'],
  ['shade_observations', 'Shade and obstruction observations'],
]

export function submitSurvey(database, surveyId, actor) {
  if (actor.role !== 'SURVEYOR') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the assigned Surveyor can submit findings')
  }
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (!['DRAFT', 'REJECTED'].includes(survey.status)) {
    throw new HttpError(409, 'SURVEY_NOT_SUBMITTABLE', 'Survey findings are not ready for submission')
  }
  const missing = SUBMISSION_REQUIRED_FIELDS
    .filter(([column]) => survey[column] === null || survey[column] === undefined || survey[column] === '')
    .map(([, label]) => label)
  if (missing.length) {
    throw new HttpError(
      400,
      'SURVEY_FINDINGS_INCOMPLETE',
      `Complete the required survey fields: ${missing.join(', ')}`,
    )
  }

  database.prepare(`
    UPDATE surveys
    SET status = 'PENDING_APPROVAL', submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        submitted_by = ?, visit_status = 'COMPLETED',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(actor.id, surveyId)
  return getSurvey(database, surveyId, actor)
}

export function reviewSurvey(database, surveyId, fields, actor) {
  if (actor.role !== 'ADMIN') {
    throw new HttpError(403, 'FORBIDDEN', 'Only an authorized administrator can review surveys')
  }
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (survey.status !== 'PENDING_APPROVAL') {
    throw new HttpError(409, 'SURVEY_NOT_PENDING', 'Only submitted surveys can be reviewed')
  }
  if (survey.assigned_surveyor_id === actor.id) {
    throw new HttpError(403, 'SELF_APPROVAL_FORBIDDEN', 'A surveyor cannot approve their own survey')
  }
  const decision = fields.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  database.prepare(`
    INSERT INTO survey_approvals (
      id, survey_id, reviewer_user_id, decision, review_action, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    surveyId,
    actor.id,
    decision,
    fields.action,
    fields.comments.trim(),
  )
  return getSurvey(database, surveyId, actor)
}

function photoById(database, surveyId, photoId) {
  const photo = database.prepare(`
    SELECT attachment.id, attachment.survey_id, attachment.file_id,
           attachment.attachment_type, attachment.created_at,
           file.storage_key, file.original_name, file.media_type, file.byte_size,
           file.uploaded_by, uploader.full_name AS uploaded_by_name
    FROM survey_attachments attachment
    JOIN stored_files file ON file.id = attachment.file_id
    LEFT JOIN users uploader ON uploader.id = file.uploaded_by
    WHERE attachment.survey_id = ? AND attachment.id = ?
  `).get(surveyId, photoId)
  if (!photo) throw new HttpError(404, 'SURVEY_PHOTO_NOT_FOUND', 'Survey photograph not found')
  return photo
}

export async function uploadSurveyPhoto(database, storageRoot, surveyId, file, actor) {
  if (actor.role !== 'SURVEYOR') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the assigned Surveyor can upload survey photographs')
  }
  const survey = getAuthorizedSurvey(database, surveyId, actor)
  if (!['DRAFT', 'REJECTED'].includes(survey.status)) {
    throw new HttpError(409, 'SURVEY_NOT_EDITABLE', 'Photographs cannot be added in the current status')
  }

  const fileId = randomUUID()
  const attachmentId = randomUUID()
  const extension = file.mediaType === 'image/png' ? 'png'
    : file.mediaType === 'image/webp' ? 'webp'
      : 'jpg'
  const storageKey = `surveys/${surveyId}/${fileId}.${extension}`
  const checksum = createHash('sha256').update(file.contents).digest('hex')
  await writeManagedFile(storageRoot, storageKey, file.contents)

  try {
    database.transaction(() => {
      database.prepare(`
        INSERT INTO stored_files (
          id, storage_key, original_name, media_type, byte_size, checksum_sha256, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        storageKey,
        file.originalName,
        file.mediaType,
        file.contents.length,
        checksum,
        actor.id,
      )
      database.prepare(`
        INSERT INTO survey_attachments (id, survey_id, file_id, attachment_type)
        VALUES (?, ?, ?, ?)
      `).run(attachmentId, surveyId, fileId, file.attachmentType)
    })()
  } catch (error) {
    try {
      await unlink(resolveManagedFilePath(storageRoot, storageKey))
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Could not save survey photo metadata or remove its incomplete managed file',
      )
    }
    throw error
  }

  return publicPhotoList(database, surveyId).find((photo) => photo.id === attachmentId)
}

export function getSurveyPhoto(database, surveyId, photoId, actor) {
  if (actor.role === 'CUSTOMER') {
    throw new HttpError(404, 'SURVEY_PHOTO_NOT_FOUND', 'Survey photograph not found')
  }
  getAuthorizedSurvey(database, surveyId, actor)
  return photoById(database, surveyId, photoId)
}
