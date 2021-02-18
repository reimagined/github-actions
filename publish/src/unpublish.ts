import * as core from '@actions/core'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import semver from 'semver'

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

const exec = (command: string) => {
  return execSync(command).toString('utf-8')
}

export const unpublish = async (version: string): Promise<void> => {
  const publishedVersion = semver.parse(version)
  if (!publishedVersion) {
    throw Error(`invalid publish version: ${version}`)
  }

  core.debug(`reading package.json`)
  const pkg = JSON.parse(readString('./package.json'))

  const { name, private: restricted } = pkg

  if (restricted) {
    core.info(`(${name}) is private package, exiting`)
    return
  }

  try {
    exec(`npm unpublish --force ${name}@${publishedVersion.version}`)
  } catch (error) {
    core.warning(error)
  }
}
