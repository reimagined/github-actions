import * as core from '@actions/core'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import semver from 'semver'
import { bumpDependencies } from './utils'

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

const exec = (command: string) => {
  return execSync(command).toString('utf-8')
}

export const publish = async (version: string, tag?: string): Promise<void> => {
  const publishVersion = semver.parse(version)
  if (!publishVersion) {
    throw Error(`invalid publish version: ${version}`)
  }

  core.debug(`reading package.json`)
  const fileContents = readString('./package.json')
  let pkg = JSON.parse(fileContents)

  const { name, private: restricted } = pkg

  if (restricted) {
    core.info(`(${name}) is private package, exiting`)
    return
  }

  core.info(
    `preparing to publish (${name}) version (${publishVersion.version}) with tag (${tag})`
  )

  const registryData = exec(
    `npm view ${name}@${publishVersion.version} 2>/dev/null`
  )

  if (registryData !== '') {
    core.warning(
      `package (${name}) version (${publishVersion.version}) already published, exiting`
    )
    return
  }

  core.debug(`bumping package.json version to (${publishVersion.version})`)
  pkg.version = publishVersion.version
  core.debug(`bumping framework dependencies`)
  pkg = bumpDependencies(
    pkg,
    '@reimagined/.*$',
    publishVersion.version,
    core.debug
  )

  writeFileSync('./package.json', JSON.stringify(pkg, null, 2))

  try {
    execSync(
      `npm publish --access=public --unsafe-perm${
        tag != null ? ` --tag=${tag}` : ''
      }`
    )
  } catch (error) {
    core.error(error)
    throw error
  } finally {
    writeFileSync('./package.json', fileContents)
  }
}
