import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import isEmpty from 'lodash.isempty'
import * as path from 'path'
import sortPackageJson from 'sort-package-json'
import findVersions from 'find-versions'
import { readFileSync, writeFileSync } from 'fs'
import { getGit } from '../../common/src/git'
import {
  bumpDependencies,
  exportEnvVar,
  processWorkspaces,
} from '../../common/src/utils'
import { Package } from '../../common/src/types'
import { PushEvent } from './types'

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

const packagePatcher = async (
  version: string,
  pkg: Package,
  location: string
) => {
  core.info(`* ${version} => [${pkg.name}] at ${location}`)
  const patchedPackage = sortPackageJson(
    bumpDependencies(pkg, `${core.getInput('framework_scope')}/.*$`, version)
  )
  patchedPackage.version = version
  writeFileSync(
    path.resolve(location, 'package.json'),
    JSON.stringify(patchedPackage, null, 2)
  )
}

export const pre = async (): Promise<void> => {
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
    path.resolve('./'),
    core
  )

  core.startGroup('configure git')
  core.debug(`requesting PAT user info`)
  const octokit = getOctokit(core.getInput('token', { required: true }))
  const {
    data: { login: name, email },
  } = await octokit.users.getAuthenticated()
  if (isEmpty(email)) {
    throw Error(
      `cannot retrieve user ${name} email with provided PAT, check GitHub account email privacy settings`
    )
  }

  core.info(`user.email: ${email}`)
  git(`config --global user.email ${email}`)

  core.info(`user.name: ${name}`)
  git(`config --global user.name ${name}`)
  core.endGroup()

  core.startGroup('preparing repository')
  const releaseBranch = core.getInput('release_branch')
  const devBranch = core.getInput('development_branch')

  core.debug(`cloning repo ${event.repository.ssh_url}`)
  git(`clone ${event.repository.ssh_url} ./`)

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

  core.startGroup(`bumping packages version to ${version}`)
  const root = path.resolve('./')
  await packagePatcher(
    version,
    JSON.parse(readFileSync(path.resolve(root, 'package.json')).toString()),
    root
  )
  await processWorkspaces(
    ({ pkg, location }) => packagePatcher(version, pkg, location),
    core.debug
  )
  core.endGroup()

  core.startGroup(`committing and pushing changes`)
  git(`add -u`)
  git(`commit -m "Bump framework version to ${version}"`)
  git(`push`)
  core.endGroup()
}
