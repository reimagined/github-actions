import { readFileSync } from 'fs'
import * as path from 'path'
import { URL } from 'url'
import { parse as parseLockFile } from '@yarnpkg/lockfile'

const errorsSymbol = Symbol('errors')

type LockFileEntry = {
  name: string
  resolved: string
  [errorsSymbol]: Array<string>
}
type EntryProcessor = (entry: LockFileEntry) => void

const packageRegistryShouldBeGlobal: EntryProcessor = (entry) => {
  const { resolved, [errorsSymbol]: errors } = entry
  const link = new URL(resolved)
  if (link.host !== 'registry.yarnpkg.com') {
    errors.push(
      `package registry should be 'registry.yarnpkg.com' but locked to ${link.host}`
    )
  }
  return entry
}

const mapYarnLockEntries = (
  ...callbacks: Array<EntryProcessor>
): Array<LockFileEntry> => {
  const contents = readFileSync(path.resolve('yarn.lock'), 'utf-8')
  const yarnLock = parseLockFile(contents)
  return Object.keys(yarnLock.object).map((key) => {
    const entry = {
      ...yarnLock.object[key],
      name: key,
      [errorsSymbol]: [],
    }
    callbacks.map((cb) => cb(entry))
    return entry
  })
}

try {
  const errors = mapYarnLockEntries(packageRegistryShouldBeGlobal).reduce<
    Array<string>
  >((output, entry) => {
    entry[errorsSymbol].map((error) => output.push(`[${entry.name}]: ${error}`))
    return output
  }, [])
  if (errors.length) {
    // eslint-disable-next-line
    errors.map((error) => console.error(error))
    process.exit(1)
  }
} catch (error) {
  // eslint-disable-next-line
  console.error(error.message)
  process.exit(1)
}
