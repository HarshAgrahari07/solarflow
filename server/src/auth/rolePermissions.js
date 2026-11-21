const ROLE_PERMISSIONS = {
  ADMIN: ['staff:create', 'finance:admin', 'warehouse:admin', 'survey:approve'],
  SALES: ['sales:manage'],
  SURVEYOR: ['survey:submit'],
  WAREHOUSE: ['warehouse:admin'],
  TECHNICIAN: ['installations:manage'],
  SUPPORT: ['support:manage'],
  FINANCE: ['finance:admin'],
  CUSTOMER: ['customer:self'],
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
