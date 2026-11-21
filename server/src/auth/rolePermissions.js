const ROLE_PERMISSIONS = {
  ADMIN: [
    'staff:create',
    'finance:admin',
    'warehouse:admin',
    'survey:approve',
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
  ],
  SURVEYOR: ['survey:submit'],
  WAREHOUSE: ['warehouse:admin'],
  TECHNICIAN: ['installations:manage'],
  SUPPORT: ['support:manage'],
  FINANCE: ['finance:admin'],
  CUSTOMER: ['customer:self', 'customer:profile:update'],
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
