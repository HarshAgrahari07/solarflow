import { z } from 'zod'

export const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase())

export const passwordSchema = z.string().min(1).max(72).refine(
  (password) => Buffer.byteLength(password, 'utf8') <= 72,
  'Password must be at most 72 bytes',
)

export const CUSTOMER_CATEGORIES = ['Home', 'Small Factory']
export const SOLAR_REQUIREMENTS = ['On-Grid System', 'Off-Grid System']
export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Survey Pending',
  'Quotation',
  'Converted',
  'Lost',
]
export const LEAD_SOURCES = ['UNKNOWN', 'WEBSITE', 'REFERRAL', 'PHONE', 'WALK_IN', 'DEMO']

const categorySchema = z.enum(CUSTOMER_CATEGORIES)
const solarRequirementSchema = z.enum(SOLAR_REQUIREMENTS)
const leadStatusSchema = z.enum(LEAD_STATUSES)
const leadSourceSchema = z.enum(LEAD_SOURCES)
const capacitySchema = z.number().min(1).max(5)
const phoneSchema = z.string().trim().min(7).max(32).regex(
  /^[+()0-9 .-]+$/,
  'Enter a valid phone number',
)
const addressSchema = z.string().trim().min(5).max(500)

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
}).strict()

export const customerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(12).max(72).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be at most 72 bytes',
  ),
  phone: z.string().trim().min(7).max(32).regex(
    /^[+()0-9 .-]+$/,
    'Enter a valid phone number',
  ),
  address: z.string().trim().min(5).max(500),
  category: categorySchema,
  solarRequirement: solarRequirementSchema,
  capacityKw: capacitySchema,
}).strict()

export const customerCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  address: addressSchema,
  category: categorySchema,
  solarRequirement: solarRequirementSchema,
  capacityKw: capacitySchema,
  leadStatus: leadStatusSchema.default('New'),
  leadSource: leadSourceSchema.default('UNKNOWN'),
  assignedTo: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(3000).default(''),
}).strict()

const customerUpdateFields = {
  fullName: z.string().trim().min(2).max(120).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  address: addressSchema.optional(),
  category: categorySchema.optional(),
  solarRequirement: solarRequirementSchema.optional(),
  capacityKw: capacitySchema.optional(),
}

export const customerUpdateSchema = z.object({
  ...customerUpdateFields,
  leadStatus: leadStatusSchema.optional(),
  leadSource: leadSourceSchema.optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(3000).optional(),
}).strict().refine((fields) => Object.keys(fields).length > 0, 'At least one field is required')

export const customerSelfUpdateSchema = z.object(customerUpdateFields)
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, 'At least one field is required')

const dueAtSchema = z.string().trim().min(1).max(40).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Enter a valid follow-up date and time',
)

export const followUpCreateSchema = z.object({
  dueAt: dueAtSchema,
  note: z.string().trim().min(1).max(2000),
  assignedTo: z.string().uuid().optional(),
}).strict()

export const followUpUpdateSchema = z.object({
  dueAt: dueAtSchema.optional(),
  note: z.string().trim().min(1).max(2000).optional(),
  completed: z.boolean().optional(),
  assignedTo: z.string().uuid().optional(),
}).strict().refine((fields) => Object.keys(fields).length > 0, 'At least one field is required')

export const customerListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  leadStatus: leadStatusSchema.optional(),
  category: categorySchema.optional(),
  assignedTo: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  recordType: z.enum(['real', 'demo', 'all']).default('real'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'leadStatus', 'assignedTo', 'nextFollowUpAt'])
    .default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeArchived: z.enum(['true', 'false']).optional(),
}).strict()

export const staffRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(12).max(72).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be at most 72 bytes',
  ),
  role: z.enum(['SALES', 'SURVEYOR', 'WAREHOUSE', 'TECHNICIAN', 'SUPPORT', 'FINANCE']),
}).strict()
