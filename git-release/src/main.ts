import * as core from '@actions/core'
import findVersions from 'find-versions'
import { mkdtempSync } from 'fs'
import { getGit } from '../../common/src/git'

type PushEvent = {
  head_commit: {
    id: string
    message: string
  }
  repository: {
    ssh_url: string
  }
}

const determineReleaseVersion = (event: PushEvent): string => {
  const versions = findVersions(event.head_commit.message)
  if (versions.length === 0) {
    throw Error(`unexpected commit message without release version`)
  }
  if (versions.length > 1) {
    throw Error(`unexpected commit message with multiple release version`)
  }
  return versions[0]
}

export const main = async (): Promise<void> => {
  core.debug(`parsing push event`)
  const event: PushEvent = JSON.parse(
    core.getInput(`push_event`, { required: true })
  )

  core.debug(`determining release version`)
  const version = determineReleaseVersion(event)
  core.debug(`release version: ${version}`)

  core.debug(`making working directory`)
  const workingDirectory = mkdtempSync('release-')
  core.debug(`working directory: ${workingDirectory}`)

  core.debug(`acquiring Git CLI`)
  const git = getGit(
    core.getInput('ssh_private_key', { required: true }),
    workingDirectory,
    core
  )

  core.startGroup('clone repo')
  core.debug(`cloning repo ${event.repository.ssh_url}`)
  git(`clone ${event.repository.ssh_url}`, 'inherit')
  git(`branch`, 'inherit')
  core.endGroup()

  return
}
