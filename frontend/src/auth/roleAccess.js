import { NAV_ITEMS } from '../data/demoData.js'

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  SALES: 'Sales',
  SURVEYOR: 'Surveyor',
  WAREHOUSE: 'Warehouse',
  TECHNICIAN: 'Technician',
  SUPPORT: 'Support',
  FINANCE: 'Finance',
  CUSTOMER: 'Customer',
}

const ROLE_NAV_IDS = {
  ADMIN: NAV_ITEMS.map((item) => item.id),
  SALES: ['overview', 'customers', 'surveys', 'quotations'],
  SURVEYOR: ['overview', 'surveys'],
  WAREHOUSE: ['overview', 'inventory'],
  TECHNICIAN: ['overview', 'installations'],
  SUPPORT: ['overview', 'warranties', 'service'],
  FINANCE: ['overview', 'finance', 'reports'],
  CUSTOMER: [],
}

export const ROLE_WORKSPACES = {
  SALES: {
    title: 'Sales workspace',
    description: 'Manage customer leads, coordinate roof surveys, and prepare quotations.',
    areas: {
      customers: 'Customer and lead workflow',
      surveys: 'Survey scheduling and review coordination',
      quotations: 'Quotation preparation and order handoff',
    },
  },
  SURVEYOR: {
    title: 'Survey workspace',
    description: 'Coordinate roof surveys and submit survey details for approval.',
    areas: {
      surveys: 'Assigned roof surveys and approval workflow',
    },
  },
  WAREHOUSE: {
    title: 'Warehouse workspace',
    description: 'Prepare picking, track serial numbers, and coordinate dispatch.',
    areas: {
      inventory: 'Inventory, picking, serial numbers, and dispatch',
    },
  },
  TECHNICIAN: {
    title: 'Technician workspace',
    description: 'Review installation assignments, checklists, and commissioning steps.',
    areas: {
      installations: 'Assigned installations, checklists, and commissioning',
    },
  },
  SUPPORT: {
    title: 'Support workspace',
    description: 'Review warranty questions and coordinate customer service requests.',
    areas: {
      warranties: 'Warranty coverage checks',
      service: 'Service complaints and follow-up',
    },
  },
  FINANCE: {
    title: 'Finance workspace',
    description: 'Review payment, invoice, subsidy, and financial reporting workflows.',
    areas: {
      finance: 'Payments, invoices, and subsidy workflow',
      reports: 'Financial reporting',
    },
  },
}

export function getNavigationForRole(role) {
  const allowedIds = ROLE_NAV_IDS[role] || []
  return NAV_ITEMS.filter((item) => allowedIds.includes(item.id))
}

export function canAccessNavigation(role, navigationId) {
  return (ROLE_NAV_IDS[role] || []).includes(navigationId)
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role
}
