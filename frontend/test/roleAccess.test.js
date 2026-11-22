import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canAccessNavigation, getNavigationForRole } from '../src/auth/roleAccess.js'
import { NAV_ITEMS } from '../src/data/demoData.js'

test('all eight roles receive only their configured navigation', () => {
  const expected = {
    ADMIN: NAV_ITEMS.map((item) => item.id),
    SALES: ['overview', 'customers', 'surveys', 'quotations'],
    SURVEYOR: ['overview', 'surveys'],
    WAREHOUSE: ['overview', 'inventory'],
    TECHNICIAN: ['overview', 'installations'],
    SUPPORT: ['overview', 'warranties', 'service'],
    FINANCE: ['overview', 'finance', 'reports'],
    CUSTOMER: [],
  }

  for (const [role, navigationIds] of Object.entries(expected)) {
    assert.deepEqual(getNavigationForRole(role).map((item) => item.id), navigationIds, role)
    for (const item of NAV_ITEMS) {
      assert.equal(canAccessNavigation(role, item.id), navigationIds.includes(item.id), `${role}: ${item.id}`)
    }
  }
})

test('unknown roles do not receive navigation permissions', () => {
  assert.deepEqual(getNavigationForRole('UNRECOGNIZED'), [])
  assert.equal(canAccessNavigation('UNRECOGNIZED', 'users'), false)
})
