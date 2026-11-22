const SECTION_PANELS = Object.freeze({
  inventory: ['inventory-table', 'dispatches', 'stock-purchases'],
  installations: ['installations'],
  warranties: ['warranty-lookup', 'service-tickets'],
  service: ['service-tickets'],
  finance: ['financial-summary', 'transaction-entry', 'stock-purchases'],
  reports: [
    'financial-summary',
    'project-profitability',
    'inventory-summary',
    'installation-summary',
    'service-summary',
  ],
})

export function hasOperationalPanel(section, panel) {
  return SECTION_PANELS[section]?.includes(panel) ?? false
}
