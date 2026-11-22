import { coreIdentityMigration } from './migrations/001_core_identity.js'
import { businessWorkflowMigration } from './migrations/002_business_workflows.js'
import { reportingMigration } from './migrations/003_reporting_and_controls.js'
import { profitabilityCompletenessMigration } from './migrations/004_profitability_completeness.js'
import { serviceWarrantyValidationMigration } from './migrations/005_service_warranty_validation.js'
import { customerLeadPipelineMigration } from './migrations/006_customer_lead_pipeline.js'
import { surveyManagementMigration } from './migrations/007_survey_management.js'
import { operationalWorkflowsMigration } from './migrations/008_operational_workflows.js'
import { stockReservationBalanceMigration } from './migrations/009_stock_reservation_balance.js'

const MIGRATIONS = [
  coreIdentityMigration,
  businessWorkflowMigration,
  reportingMigration,
  profitabilityCompletenessMigration,
  serviceWarrantyValidationMigration,
  customerLeadPipelineMigration,
  surveyManagementMigration,
  operationalWorkflowsMigration,
  stockReservationBalanceMigration,
]

export function runMigrations(database, migrations = MIGRATIONS) {
  database.pragma('foreign_keys = ON')
  if (database.pragma('foreign_keys', { simple: true }) !== 1) {
    throw new Error('Database migrations require SQLite foreign-key enforcement.')
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `)

  const orderedMigrations = [...migrations].sort((left, right) => left.version - right.version)
  const versions = new Set()
  for (const [index, migration] of orderedMigrations.entries()) {
    if (
      !Number.isSafeInteger(migration.version)
      || migration.version < 1
      || !migration.name
      || typeof migration.up !== 'function'
    ) {
      throw new Error('Database migrations require a positive integer version, name, and up function.')
    }
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate database migration version ${migration.version}.`)
    }
    if (migration.version !== index + 1) {
      throw new Error(`Database migration definitions have a gap before version ${migration.version}.`)
    }
    versions.add(migration.version)
  }

  const applied = database.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all()
  const knownByVersion = new Map(orderedMigrations.map((migration) => [migration.version, migration]))
  for (const [index, row] of applied.entries()) {
    const migration = knownByVersion.get(row.version)
    if (!migration || migration.name !== row.name) {
      throw new Error(`Applied database migration ${row.version} (${row.name}) is missing or changed.`)
    }
    if (orderedMigrations[index]?.version !== row.version) {
      throw new Error(`Database migration history has a gap before version ${row.version}.`)
    }
  }

  for (const migration of orderedMigrations) {
    const existing = applied.find((row) => row.version === migration.version)
    if (existing) continue

    const transaction = database.transaction(() => {
      migration.up(database)
      const violations = database.pragma('foreign_key_check')
      if (violations.length) {
        throw new Error(`Foreign-key check found ${violations.length} violation(s).`)
      }
      database.prepare(`
        INSERT INTO schema_migrations (version, name)
        VALUES (?, ?)
      `).run(migration.version, migration.name)
    })

    try {
      transaction()
    } catch (error) {
      throw new Error(
        `Database migration ${migration.version} (${migration.name}) failed; its transaction was rolled back: ${error.message}`,
        { cause: error },
      )
    }
  }

  return database.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all()
}
