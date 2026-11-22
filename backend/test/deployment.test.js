import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { loadConfig, BACKEND_ROOT } from '../src/config/env.js'
import { openDatabase } from '../src/database/connection.js'
import { cookieOptions } from '../src/middleware/authenticate.js'

function setEnvironment(context, values) {
  const keys = ['NODE_ENV', 'PORT', 'JWT_SECRET', 'DATA_DIR', 'DATABASE_PATH', 'FILE_STORAGE_PATH', 'FRONTEND_ORIGIN']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  context.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  })
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key]
    else process.env[key] = values[key]
  }
}

test('production configuration keeps database and uploads within the data directory', (context) => {
  const dataDir = path.join(os.tmpdir(), `sunpower-config-${randomBytes(8).toString('hex')}`)
  setEnvironment(context, {
    NODE_ENV: 'production',
    PORT: '4000',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    DATA_DIR: dataDir,
    DATABASE_PATH: path.join(dataDir, 'sunpower.sqlite'),
    FILE_STORAGE_PATH: path.join(dataDir, 'uploads'),
    FRONTEND_ORIGIN: 'https://sunpower.example',
  })

  const config = loadConfig()
  assert.equal(config.dataDir, dataDir)
  assert.equal(config.databasePath, path.join(dataDir, 'sunpower.sqlite'))
  assert.equal(config.fileStoragePath, path.join(dataDir, 'uploads'))
  assert.equal(config.frontendOrigin, 'https://sunpower.example')
})

test('production rejects ephemeral database paths, HTTP origins, and missing secrets', (context) => {
  const dataDir = path.join(os.tmpdir(), `sunpower-config-${randomBytes(8).toString('hex')}`)
  const valid = {
    NODE_ENV: 'production',
    PORT: '4000',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    DATA_DIR: dataDir,
    DATABASE_PATH: path.join(dataDir, 'sunpower.sqlite'),
    FILE_STORAGE_PATH: path.join(dataDir, 'uploads'),
    FRONTEND_ORIGIN: 'https://sunpower.example',
  }

  setEnvironment(context, valid)
  process.env.DATABASE_PATH = path.join(os.tmpdir(), 'outside.sqlite')
  assert.throws(() => loadConfig(), /DATABASE_PATH must be inside DATA_DIR/)

  process.env.DATABASE_PATH = valid.DATABASE_PATH
  process.env.FILE_STORAGE_PATH = path.join(os.tmpdir(), 'outside-uploads')
  assert.throws(() => loadConfig(), /FILE_STORAGE_PATH must be inside DATA_DIR/)

  process.env.FILE_STORAGE_PATH = valid.FILE_STORAGE_PATH
  process.env.FRONTEND_ORIGIN = 'http://sunpower.example'
  assert.throws(() => loadConfig(), /FRONTEND_ORIGIN must use HTTPS/)

  process.env.FRONTEND_ORIGIN = valid.FRONTEND_ORIGIN
  process.env.JWT_SECRET = ''
  assert.throws(() => loadConfig(), /Invalid server configuration/)
})

test('local database and upload paths keep their existing backend/data defaults', (context) => {
  setEnvironment(context, {
    NODE_ENV: 'development',
    PORT: '4000',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    DATA_DIR: path.join(BACKEND_ROOT, 'data'),
    DATABASE_PATH: 'data/sunpower.sqlite',
    FILE_STORAGE_PATH: 'data/uploads',
    FRONTEND_ORIGIN: 'http://localhost:5173',
  })

  const config = loadConfig()
  assert.equal(config.dataDir, path.join(BACKEND_ROOT, 'data'))
  assert.equal(config.databasePath, path.join(BACKEND_ROOT, 'data', 'sunpower.sqlite'))
  assert.equal(config.fileStoragePath, path.join(BACKEND_ROOT, 'data', 'uploads'))
})

test('production authentication cookies remain secure and HttpOnly', () => {
  const options = cookieOptions({ nodeEnv: 'production' })
  assert.equal(options.httpOnly, true)
  assert.equal(options.secure, true)
  assert.equal(options.sameSite, 'lax')
})

test('production serves the SPA, keeps API misses as JSON, and protects file routes', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sunpower-production-smoke-'))
  const dataDir = path.join(root, 'data')
  const frontendDistPath = path.join(root, 'frontend')
  fs.mkdirSync(frontendDistPath, { recursive: true })
  fs.writeFileSync(path.join(frontendDistPath, 'index.html'), '<!doctype html><title>SunPower smoke</title>')
  fs.mkdirSync(path.join(frontendDistPath, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(frontendDistPath, 'assets', 'app.js'), 'window.sunpowerReady = true')

  const database = openDatabase(':memory:')
  const app = createApp({
    database,
    config: {
      nodeEnv: 'production',
      port: 0,
      jwtSecret: randomBytes(48).toString('base64url'),
      dataDir,
      databasePath: ':memory:',
      fileStoragePath: path.join(dataDir, 'uploads'),
      frontendOrigin: null,
      frontendDistPath,
    },
  })
  const server = createServer(app)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  context.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    database.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  const origin = `http://127.0.0.1:${server.address().port}`
  const page = await fetch(`${origin}/login`)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /SunPower smoke/)

  const asset = await fetch(`${origin}/assets/app.js`)
  assert.equal(asset.status, 200)
  assert.match(await asset.text(), /sunpowerReady/)

  const health = await fetch(`${origin}/api/health`, { headers: { Origin: origin } })
  assert.equal(health.status, 200)
  assert.equal(health.headers.get('access-control-allow-origin'), origin)
  assert.deepEqual(await health.json(), { status: 'ok', database: 'ok', readiness: 'ready' })

  const deniedOrigin = await fetch(`${origin}/api/health`, {
    headers: { Origin: 'https://attacker.example' },
  })
  assert.equal(deniedOrigin.status, 403)
  assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null)

  const missingApi = await fetch(`${origin}/api/not-a-route`)
  assert.equal(missingApi.status, 404)
  assert.match(missingApi.headers.get('content-type'), /application\/json/)
  assert.doesNotMatch(await missingApi.text(), /SunPower smoke/)

  const privatePhoto = await fetch(`${origin}/api/surveys/not-a-survey/photos/not-a-photo`)
  assert.equal(privatePhoto.status, 401)
  assert.match(privatePhoto.headers.get('content-type'), /application\/json/)

  assert.equal(app.get('trust proxy'), 1)
})
