import * as core from '@actions/core'
import * as path from 'path'
import findVersions from 'find-versions'
import { getGit } from '../../common/src/git'
import { exportEnvVar } from '../../common/src/utils'
import { PushEvent } from './types'
import { execSync } from 'child_process'

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

const tagName = (version: string) => `V${version.trim()}`

export const pre = async (): Promise<void> => {
  core.debug(`working dir is: ${path.resolve('./')}`)
  core.debug(`content: ${execSync(`ls -la`, { stdio: 'pipe' })}`)
  core.debug(`parsing push event`)
  const event: PushEvent = JSON.parse(
    core.getInput(`push_event`, { required: true })
  )

  core.debug(`determining release version`)
  const version = determineReleaseVersion(event)
  core.debug(`release version: ${version}`)
  core.saveState(`version`, version)
  exportEnvVar('git_release_version', version)

  core.debug(`acquiring Git CLI`)
  const git = getGit(
    core.getInput('ssh_private_key', { required: true }),
    './',
    core
  )

  core.startGroup('preparing repository')
  const releaseBranch = core.getInput('release_branch')
  const devBranch = core.getInput('development_branch')

  core.debug(`cloning repo ${event.repository.ssh_url}`)
  git(`clone ${event.repository.ssh_url} ./`, 'inherit')

  core.debug(`checking out development branch: ${devBranch}`)
  git(`checkout ${devBranch}`)

  core.debug(`checking out release branch: ${releaseBranch}`)
  git(`checkout ${releaseBranch}`)

  core.debug(`resetting release branch to push commit: ${event.head_commit.id}`)
  git(`reset --hard ${event.head_commit.id}`)

  const versionBranch = tagName(version)
  core.debug(`making version branch ${versionBranch}`)
  git(`checkout -b ${versionBranch} --track`)
  core.endGroup()
}
