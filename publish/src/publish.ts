import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import semver from 'semver'
import { bumpDependencies } from '../../common/src/utils'

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

const exec = (command: string, cwd?: string) => {
  const additionalOptions = cwd ? { cwd } : {}
  return execSync(command, { stdio: 'pipe', ...additionalOptions }).toString(
    'utf-8'
  )
}

export const publish = async (
  version: string,
  options?: {
    tag?: string
    location?: string
    repository?: string
    frameworkScope?: string
  }
): Promise<void> => {
  const publishVersion = semver.parse(version)
  if (!publishVersion) {
    throw Error(`invalid publish version: ${version}`)
  }

  const { tag, location, repository, frameworkScope } = options ?? {}

  const packageLocation = location || '.'

  const fileContents = readString(`${packageLocation}/package.json`)
  let pkg = JSON.parse(fileContents)

  const { name, private: restricted } = pkg

  if (restricted) {
    return
  }

  let packagePublished = false

  try {
    const registryData = exec(`npm view ${name}@${version}`)
    if (registryData != '') {
      packagePublished = true
    }
  } catch (error) {
    if (!error.message.includes('ERR! 404')) {
      throw error
    }
  }

  if (packagePublished) {
    return
  }

  pkg.version = version
  if (frameworkScope != null && frameworkScope !== '') {
    pkg = bumpDependencies(pkg, `${frameworkScope}/.*$`, version)
  }
  if (repository != null && frameworkScope !== '') {
    pkg.repository = repository
  }

  writeFileSync(`${packageLocation}/package.json`, JSON.stringify(pkg, null, 2))

  try {
    exec(
      `npm publish --access=public --unsafe-perm${
        tag != null && tag !== '' ? ` --tag=${tag}` : ''
      }`,
      location
    )
  } catch (error) {
    throw error
  } finally {
    writeFileSync(`${packageLocation}/package.json`, fileContents)
  }
}
