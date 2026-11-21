import { z } from 'zod'

const componentCodes = [
  'PANELS', 'CONNECTORS', 'WIRES', 'INVERTER', 'WIRING_BOXES',
  'CHARGE_CONTROLLER', 'SAFETY_EARTHING', 'METAL_STANDS',
  'LARGE_BATTERY', 'SWITCHES', 'SAFETY_PARTS', 'INSTALLATION_SERVICE',
]
const productTypes = [
  'PANEL', 'CONNECTOR', 'WIRE', 'INVERTER', 'WIRING_BOXES',
  'CHARGE_CONTROLLER', 'SAFETY_EARTHING', 'METAL_STAND',
  'BATTERY', 'SWITCH', 'SAFETY_PART', 'INSTALLATION_SERVICE', 'OTHER',
]

export const quotationCreateSchema = z.object({
  surveyId: z.string().uuid(),
  packageTemplateId: z.string().uuid().optional(),
  terms: z.string().trim().max(5000).default(''),
  items: z.array(z.object({
    templateItemId: z.string().trim().min(1).max(100).optional(),
    productType: z.enum(productTypes).optional(),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().trim().min(1).max(40).default('unit'),
    unitPrice: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
  }).strict()).max(100).optional(),
}).strict()

export const quotationItemsSchema = z.object({
  items: z.array(z.object({
    templateItemId: z.string().trim().min(1).max(100).optional(),
    productType: z.enum(productTypes).optional(),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().trim().min(1).max(40).default('unit'),
    unitPrice: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
  }).strict()).min(1).max(100),
}).strict()

export const quotationStatusSchema = z.object({
  status: z.enum(['PENDING', 'RELEASED']),
}).strict()

export const quotationResponseSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
  comments: z.string().trim().max(2000).default(''),
}).strict()

export const packageTemplateUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  items: z.array(z.object({
    componentCode: z.enum(componentCodes),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(1_000_000).nullable().optional(),
    unit: z.string().trim().min(1).max(40).default('unit'),
    unitPrice: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
  }).strict()).min(1).max(100),
}).strict()
