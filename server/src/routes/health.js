import { Router } from 'express'

export function createHealthRouter(database) {
  const router = Router()

  router.get('/', (request, response) => {
    database.prepare('SELECT 1').get()
    response.json({ status: 'ok' })
  })

  return router
}
