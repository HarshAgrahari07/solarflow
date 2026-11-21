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

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      linked_user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
      email TEXT COLLATE NOCASE UNIQUE
        CHECK (email IS NULL OR (email = lower(email) AND length(email) BETWEEN 3 AND 254)),
      phone TEXT CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 7 AND 32),
      address TEXT CHECK (address IS NULL OR length(trim(address)) BETWEEN 5 AND 500),
      category TEXT CHECK (category IS NULL OR category IN ('Home', 'Small Factory')),
      solar_requirement TEXT CHECK (
        solar_requirement IS NULL OR solar_requirement IN ('On-Grid System', 'Off-Grid System', 'Solar Panel Set')
      ),
      capacity_kw REAL CHECK (capacity_kw IS NULL OR capacity_kw BETWEEN 1.0 AND 5.0),
      lead_status TEXT NOT NULL DEFAULT 'New' CHECK (
        lead_status IN ('New', 'Contacted', 'Qualified', 'Survey Scheduled', 'Quoted', 'Won', 'Lost')
      ),
      assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 3000),
      is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_assigned_status
      ON customers(assigned_to, lead_status, is_archived);
    CREATE INDEX IF NOT EXISTS idx_customers_created_at
      ON customers(created_at);

    CREATE TABLE IF NOT EXISTS customer_follow_ups (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      assigned_to TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      due_at TEXT NOT NULL,
      note TEXT NOT NULL CHECK (length(trim(note)) BETWEEN 1 AND 2000),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customer_follow_ups_due
      ON customer_follow_ups(customer_id, completed_at, due_at);
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

  const insertLegacyCustomer = database.prepare(`
    INSERT OR IGNORE INTO customers (id, linked_user_id, full_name, email, phone, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const legacyCustomers = database.prepare(`
    SELECT id, full_name, email, phone, address
    FROM users
    WHERE role = 'CUSTOMER'
  `).all()
  for (const user of legacyCustomers) {
    insertLegacyCustomer.run(
      `customer-${user.id}`,
      user.id,
      user.full_name,
      user.email,
      user.phone,
      user.address,
    )
  }
}
