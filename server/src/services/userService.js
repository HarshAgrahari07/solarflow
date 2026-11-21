import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { findUserByEmail } from '../database/users.js'
import { HttpError } from '../errors.js'

const BCRYPT_ROUNDS = 12

export async function createUser(database, { fullName, email, password, role, phone, address }) {
  const normalizedEmail = email.trim().toLowerCase()
  if (findUserByEmail(database, normalizedEmail)) {
    throw new HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const id = randomUUID()

  try {
    database.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, role, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, fullName.trim(), normalizedEmail, passwordHash, role, phone ?? null, address ?? null)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists')
    }
    throw error
  }

  return findUserByEmail(database, normalizedEmail)
}
