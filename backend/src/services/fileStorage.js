import { mkdir, open, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

function isWithinDirectory(root, target) {
  const relative = path.relative(root, target)
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
}

export function resolveManagedFilePath(storageRoot, storageKey) {
  if (
    typeof storageKey !== 'string'
    || storageKey.length > 500
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(storageKey)
    || storageKey.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new TypeError('Storage key must be a normalized relative path.')
  }

  const root = path.resolve(storageRoot)
  const target = path.resolve(root, ...storageKey.split('/'))
  if (!isWithinDirectory(root, target)) {
    throw new TypeError('Storage key resolves outside the managed storage root.')
  }
  return target
}

export async function writeManagedFile(storageRoot, storageKey, contents) {
  if (!Buffer.isBuffer(contents)) {
    throw new TypeError('Managed file contents must be a Buffer.')
  }

  const target = resolveManagedFilePath(storageRoot, storageKey)
  await mkdir(storageRoot, { recursive: true, mode: 0o700 })
  const realRoot = await realpath(storageRoot)
  const parent = path.dirname(target)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  const realParent = await realpath(parent)
  if (!isWithinDirectory(realRoot, realParent) && realRoot !== realParent) {
    throw new TypeError('Managed file path resolves outside the managed storage root.')
  }

  const managedTarget = path.join(realParent, path.basename(target))
  const file = await open(managedTarget, 'wx', 0o600)
  try {
    await file.writeFile(contents)
    await file.sync()
  } finally {
    await file.close()
  }
  return storageKey
}

export async function readManagedFile(storageRoot, storageKey) {
  const target = resolveManagedFilePath(storageRoot, storageKey)
  const realRoot = await realpath(storageRoot)
  const realTarget = await realpath(target)
  if (!isWithinDirectory(realRoot, realTarget)) {
    throw new TypeError('Managed file resolves outside the managed storage root.')
  }
  const details = await stat(realTarget)
  if (!details.isFile()) {
    throw new TypeError('Managed file key does not reference a regular file.')
  }
  return readFile(realTarget)
}
