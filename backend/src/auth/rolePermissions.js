const ROLE_PERMISSIONS = {
  ADMIN: [
    'staff:create',
    'finance:admin',
    'warehouse:admin',
    'survey:approve',
    'surveys:read',
    'surveys:schedule',
    'survey:submit',
    'quotations:manage',
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:archive',
    'customers:followups',
  ],
  SALES: [
    'sales:manage',
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:followups',
    'surveys:read',
    'surveys:schedule',
    'quotations:manage',
  ],
  SURVEYOR: ['survey:submit', 'surveys:read'],
  WAREHOUSE: ['warehouse:admin'],
  TECHNICIAN: ['installations:manage'],
  SUPPORT: ['support:manage'],
  FINANCE: ['finance:admin'],
  CUSTOMER: ['customer:self', 'customer:profile:update', 'surveys:read', 'quotations:self'],
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
