import { z } from 'zod'

export const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase())

export const passwordSchema = z.string().min(1).max(72).refine(
  (password) => Buffer.byteLength(password, 'utf8') <= 72,
  'Password must be at most 72 bytes',
)

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
