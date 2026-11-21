export const coreIdentityMigration = {
  version: 1,
  name: 'core_identity_and_legacy_crm',

  up(database) {
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
    `)

    const userColumns = new Set(database.pragma('table_info(users)').map((column) => column.name))
    if (!userColumns.has('is_active')) {
      database.exec(`
        ALTER TABLE users
        ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
      `)
    }
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
    if (!userColumns.has('created_at')) {
      database.exec(`ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`)
      database.exec(`
        UPDATE users SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE created_at = ''
      `)
    }
    if (!userColumns.has('updated_at')) {
      database.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`)
      database.exec(`
        UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE updated_at = ''
      `)
    }

    database.exec(`
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

      CREATE TABLE IF NOT EXISTS permissions (
        code TEXT PRIMARY KEY,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
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
        permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
        PRIMARY KEY (role, permission_code)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 100),
        entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 100),
        entity_id TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
        ON audit_logs(entity_type, entity_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
        ON audit_logs(actor_user_id, created_at);
    `)

    const legacyCustomers = database.prepare(`
      SELECT id, full_name, email, phone, address
      FROM users
      WHERE role = 'CUSTOMER'
    `).all()
    const insertLegacyCustomer = database.prepare(`
      INSERT OR IGNORE INTO customers (id, linked_user_id, full_name, email, phone, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
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

    const permissions = [
      ['staff:create', 'Create internal staff accounts'],
      ['finance:admin', 'Manage finance records'],
      ['warehouse:admin', 'Manage warehouse records'],
      ['survey:approve', 'Approve site surveys'],
      ['survey:submit', 'Submit site surveys'],
      ['sales:manage', 'Manage sales records'],
      ['customers:read', 'Read customer and lead records'],
      ['customers:create', 'Create customer and lead records'],
      ['customers:update', 'Update customer and lead records'],
      ['customers:archive', 'Archive unlinked leads'],
      ['customers:followups', 'Manage assigned customer follow-ups'],
      ['installations:manage', 'Manage installation records'],
      ['support:manage', 'Manage service records'],
      ['customer:self', 'Access own customer account'],
      ['customer:profile:update', 'Update own customer profile'],
    ]
    const insertPermission = database.prepare(`
      INSERT OR IGNORE INTO permissions (code, description) VALUES (?, ?)
    `)
    for (const permission of permissions) insertPermission.run(...permission)

    const rolePermissions = {
      ADMIN: [
        'staff:create', 'finance:admin', 'warehouse:admin', 'survey:approve',
        'customers:read', 'customers:create', 'customers:update',
        'customers:archive', 'customers:followups',
      ],
      SALES: ['sales:manage', 'customers:read', 'customers:create', 'customers:update', 'customers:followups'],
      SURVEYOR: ['survey:submit'],
      WAREHOUSE: ['warehouse:admin'],
      TECHNICIAN: ['installations:manage'],
      SUPPORT: ['support:manage'],
      FINANCE: ['finance:admin'],
      CUSTOMER: ['customer:self', 'customer:profile:update'],
    }
    const insertRolePermission = database.prepare(`
      INSERT OR IGNORE INTO role_permissions (role, permission_code) VALUES (?, ?)
    `)
    for (const [role, codes] of Object.entries(rolePermissions)) {
      for (const code of codes) insertRolePermission.run(role, code)
    }
  },
}
