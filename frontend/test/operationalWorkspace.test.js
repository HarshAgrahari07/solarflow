import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasOperationalPanel } from '../src/operationalWorkspaceSections.js'

test('finance and reports expose distinct operational panels', () => {
  for (const panel of ['financial-summary', 'transaction-entry', 'stock-purchases']) {
    assert.equal(hasOperationalPanel('finance', panel), true)
  }
  for (const panel of ['project-profitability', 'inventory-summary', 'installation-summary', 'service-summary']) {
    assert.equal(hasOperationalPanel('reports', panel), true)
    assert.equal(hasOperationalPanel('finance', panel), false)
  }
  assert.equal(hasOperationalPanel('reports', 'transaction-entry'), false)
  assert.equal(hasOperationalPanel('reports', 'stock-purchases'), false)
  assert.equal(hasOperationalPanel('finance', 'inventory-table'), false)
})

test('service requests and warranties use separate role workspaces', () => {
  assert.equal(hasOperationalPanel('service', 'service-tickets'), true)
  assert.equal(hasOperationalPanel('service', 'warranty-lookup'), false)
  assert.equal(hasOperationalPanel('warranties', 'warranty-lookup'), true)
  assert.equal(hasOperationalPanel('warranties', 'service-tickets'), true)
})
