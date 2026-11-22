import { z } from 'zod'

const id = z.string().trim().min(1).max(128)
const dateTime = z.string().trim().min(1).max(40).refine(
  (value) => Number.isFinite(Date.parse(value)),
  'Enter a valid date and time',
)
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  },
  'Enter a valid date',
)
const positiveAmount = z.number().positive().max(1_000_000_000)
const amount = z.number().nonnegative().max(1_000_000_000)

export const orderCreateSchema = z.object({
  quoteId: id,
  requiredAdvanceAmount: positiveAmount.optional(),
}).strict()

export const paymentCreateSchema = z.object({
  type: z.enum(['ADVANCE', 'FULL']),
  amount: positiveAmount,
  method: z.enum(['BANK_TRANSFER', 'UPI', 'CASH', 'CARD', 'OTHER']).optional(),
  reference: z.string().trim().max(120).optional(),
  recordedAt: dateTime.optional(),
}).strict()

export const stockReceiptSchema = z.object({
  warehouseId: id,
  inventoryItemId: id,
  quantity: positiveAmount,
  serialNumber: z.string().trim().min(1).max(120).optional(),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
}).strict()

export const dispatchWarehouseSchema = z.object({ warehouseId: id }).strict()
export const dispatchSerialSchema = z.object({
  serialNumber: z.string().trim().min(1).max(120),
}).strict()
export const dispatchStatusSchema = z.object({
  status: z.enum(['READY', 'DISPATCHED', 'DELIVERED']),
}).strict()

export const installationScheduleSchema = z.object({
  scheduledStart: dateTime,
  scheduledEnd: dateTime.optional(),
  technicianIds: z.array(id).min(1).max(30),
  notes: z.string().trim().max(2000).optional(),
}).strict().refine(
  (fields) => !fields.scheduledEnd || Date.parse(fields.scheduledEnd) > Date.parse(fields.scheduledStart),
  { message: 'Scheduled end must be after the start', path: ['scheduledEnd'] },
)

export const checklistUpdateSchema = z.object({
  isComplete: z.boolean(),
  notes: z.string().trim().max(2000).default(''),
}).strict()

export const timeLogSchema = z.object({
  startedAt: dateTime,
  endedAt: dateTime.optional(),
  notes: z.string().trim().max(2000).default(''),
}).strict().refine(
  (fields) => !fields.endedAt || Date.parse(fields.endedAt) > Date.parse(fields.startedAt),
  { message: 'End time must be after start time', path: ['endedAt'] },
)

export const generationTestSchema = z.object({
  result: z.string().trim().min(1).max(4000),
}).strict()

export const customerSignoffSchema = z.object({
  notes: z.string().trim().max(2000).default(''),
}).strict()

export const serviceTicketCreateSchema = z.object({
  customerId: id.optional(),
  orderId: id.optional(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(4000),
  faultCode: z.string().trim().max(100).default(''),
  serialNumber: z.string().trim().min(1).max(120).optional(),
}).strict()

export const serviceAssignSchema = z.object({
  supportUserId: id,
}).strict()

export const serviceResolutionSchema = z.object({
  type: z.enum(['REPAIR', 'REPLACEMENT', 'ADVICE', 'NO_FAULT_FOUND', 'OTHER']),
  partsCharge: amount.optional(),
  labourCharge: amount.optional(),
  notes: z.string().trim().max(4000).default(''),
}).strict()

export const serviceConfirmationSchema = z.object({
  confirmed: z.boolean(),
  notes: z.string().trim().max(2000).default(''),
}).strict()

export const expenseCreateSchema = z.object({
  orderId: id.optional(),
  type: z.enum(['TRAVEL', 'PERMIT', 'MATERIAL', 'SERVICE', 'OTHER']),
  description: z.string().trim().min(1).max(500),
  amount,
  incurredAt: dateTime,
}).strict()

export const payrollCreateSchema = z.object({
  jobId: id,
  technicianUserId: id,
  hours: positiveAmount,
  hourlyRate: amount.optional(),
  amount: amount.optional(),
  paidAt: dateTime.optional(),
  notes: z.string().trim().max(2000).default(''),
}).strict().refine(
  (fields) => (fields.hourlyRate === undefined) !== (fields.amount === undefined),
  { message: 'Enter exactly one configured hourly rate or payroll amount', path: ['amount'] },
)

export const invoiceCreateSchema = z.object({
  orderId: id,
  dueAt: dateTime.optional(),
}).strict()

export const invoiceStatusSchema = z.object({
  status: z.enum(['ISSUED', 'VOID']),
}).strict()

export const stockPurchaseCreateSchema = z.object({
  warehouseId: id,
  orderId: id.optional(),
  supplierName: z.string().trim().min(1).max(200),
  purchasedAt: dateTime,
  items: z.array(z.object({
    inventoryItemId: id,
    quantity: positiveAmount,
    unitCost: amount.optional(),
  }).strict()).min(1).max(100),
}).strict()

export const stockPurchaseReceiveSchema = z.object({
  serials: z.array(z.object({
    purchaseItemId: id,
    serialNumbers: z.array(z.string().trim().min(1).max(120)).min(1).max(1000),
  }).strict()).max(100),
}).strict()

export const financeReportQuerySchema = z.object({
  from: date.optional(),
  to: date.optional(),
}).strict().refine(
  (fields) => !fields.from || !fields.to || fields.from <= fields.to,
  { message: 'Start date must not be after end date', path: ['from'] },
)
