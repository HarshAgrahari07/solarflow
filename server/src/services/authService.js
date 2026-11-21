import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail } from '../database/users.js'
import { HttpError } from '../errors.js'
import { registerCustomerAccount } from './customerService.js'

const GENERIC_CREDENTIALS_ERROR = 'Invalid email or password'

export function createAuthService({ database, config }) {
  return {
    async login({ email, password }) {
      const user = findUserByEmail(database, email.trim().toLowerCase())
      if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIALS_ERROR)
      }

      const token = jwt.sign(
        { sub: user.id },
        config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: '8h',
          issuer: 'sunpower-api',
          audience: 'sunpower-web',
        },
      )

      return { user, token }
    },

    async registerCustomer({
      fullName,
      email,
      password,
      phone,
      address,
      category,
      solarRequirement,
      capacityKw,
    }) {
      return registerCustomerAccount(database, {
        fullName,
        email,
        password,
        phone,
        address,
        category,
        solarRequirement,
        capacityKw,
      })
    },
  }
}
