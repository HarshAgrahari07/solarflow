export function initializeDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (
        role IN (
          'ADMIN',
          'SALES',
          'SURVEYOR',
          'WAREHOUSE',
          'TECHNICIAN',
          'SUPPORT',
          'FINANCE',
          'CUSTOMER'
        )
      ),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      phone TEXT CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 7 AND 32),
      address TEXT CHECK (address IS NULL OR length(trim(address)) BETWEEN 5 AND 500),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role_active
      ON users(role, is_active);

    CREATE INDEX IF NOT EXISTS idx_users_created_at
      ON users(created_at);
  `)

  const userColumns = new Set(database.pragma('table_info(users)').map((column) => column.name))
  if (!userColumns.has('phone')) {
    database.exec(`
      ALTER TABLE users
      ADD COLUMN phone TEXT CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 7 AND 32)
    `)
  }
  if (!userColumns.has('address')) {
    database.exec(`
      ALTER TABLE users
      ADD COLUMN address TEXT CHECK (address IS NULL OR length(trim(address)) BETWEEN 5 AND 500)
    `)
  }
}
