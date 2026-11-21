import { runMigrations } from './migrate.js'

export function initializeDatabase(database) {
  return runMigrations(database)
}
