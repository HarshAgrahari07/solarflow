import { z } from 'zod'

const uuidSchema = z.string().uuid()
const dateTimeSchema = z.string().trim().min(1).max(40).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Enter a valid date and time',
)

const surveyFields = {
  shadowFreeRoofAreaSqm: z.number().min(0).max(1_000_000).optional(),
  monthlyElectricityBillInr: z.number().min(0).max(1_000_000_000).optional(),
  gridSuitability: z.enum(['SUITABLE', 'UNSUITABLE', 'UNKNOWN']).optional(),
  customerRequirements: z.string().trim().max(3000).optional(),
  preliminaryObservations: z.string().trim().max(3000).optional(),
  roofDirection: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'UNKNOWN']).optional(),
  roofTiltDegrees: z.number().min(0).max(90).optional(),
  cableDistanceMeters: z.number().min(0).max(1_000_000).optional(),
  actualAvailableRoofAreaSqm: z.number().min(0).max(1_000_000).optional(),
  siteCondition: z.string().trim().max(2000).optional(),
  shadeObservations: z.string().trim().max(3000).optional(),
  technicalNotes: z.string().trim().max(5000).optional(),
}

export const surveyCreateSchema = z.object({
  customerId: uuidSchema,
  assignedSurveyorId: uuidSchema,
  scheduledAt: dateTimeSchema,
  siteAddress: z.string().trim().min(5).max(500),
}).strict()

export const surveyScheduleUpdateSchema = z.object({
  assignedSurveyorId: uuidSchema.optional(),
  scheduledAt: dateTimeSchema.optional(),
  siteAddress: z.string().trim().min(5).max(500).optional(),
}).strict().refine((fields) => Object.keys(fields).length > 0, 'At least one field is required')

export const surveyUpdateSchema = z.object(surveyFields)
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, 'At least one field is required')

export const surveySubmitSchema = z.object({}).strict()

export const surveyVisitStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'CANCELLED']),
}).strict()

export const surveyReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CORRECTIONS']),
  comments: z.string().trim().max(3000).default(''),
}).strict().refine(
  ({ action, comments }) => action === 'APPROVE' || comments.length > 0,
  'A reason is required when rejecting or requesting corrections',
)

export const surveyListQuerySchema = z.object({
  status: z.enum([
    'SCHEDULED',
    'IN_PROGRESS',
    'DRAFT',
    'PENDING_APPROVAL',
    'CHANGES_REQUESTED',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
  ]).optional(),
  search: z.string().trim().max(100).optional(),
}).strict()
