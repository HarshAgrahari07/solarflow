export function findUserByEmail(database, email) {
  return database.prepare(`
    SELECT id, full_name, email, password_hash, role, is_active, phone, address, created_at, updated_at
    FROM users
    WHERE email = ?
  `).get(email)
}

export function findUserById(database, id) {
  return database.prepare(`
    SELECT id, full_name, email, password_hash, role, is_active, phone, address, created_at, updated_at
    FROM users
    WHERE id = ?
  `).get(id)
}

export function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
    phone: user.phone ?? null,
    address: user.address ?? null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}
