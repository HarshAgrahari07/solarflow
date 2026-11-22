import { Router } from 'express'

export function createHealthRouter(database) {
  const router = Router()

  router.get('/', (request, response) => {
    database.prepare('SELECT 1').get()
    database.prepare('SELECT max(version) FROM schema_migrations').get()
    response.json({ status: 'ok', database: 'ok', readiness: 'ready' })
  })

  return router
}
