import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export function openDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  }

  const database = new Database(databasePath)
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  if (databasePath !== ':memory:') {
    database.pragma('journal_mode = WAL')
    if (process.platform !== 'win32') {
      fs.chmodSync(databasePath, 0o600)
    }
  }
  return database
}
