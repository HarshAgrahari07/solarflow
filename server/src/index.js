import { createApp } from './app.js'

const app = createApp()
const server = app.listen(app.locals.config.port, () => {
  console.log(`SunPower API listening on http://localhost:${app.locals.config.port}`)
})

server.on('error', (error) => {
  console.error('Unable to start the SunPower API:', error)
  app.locals.database.close()
  process.exitCode = 1
})

function shutdown() {
  server.close((error) => {
    app.locals.database.close()
    if (error) {
      console.error('Error while shutting down the SunPower API:', error)
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
