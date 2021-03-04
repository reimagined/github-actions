import { readFileSync } from 'fs'
import * as core from '@actions/core'
import { execSync } from 'child_process'
import semver from 'semver'
import { getOctokit } from '@actions/github'
import { parseBoolean } from '../../common/src/utils'

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

const exec = (command: string) => {
  return execSync(command).toString('utf-8')
}

const unpublishFromGithubRegistry = async (
  scopedPackageName: string,
  packageVersion: string
) => {
  const registryToken = core.getInput('token', { required: true })
  const frameworkScope = core.getInput('framework_scope')
  const packageName = scopedPackageName.replace(`${frameworkScope}/`, '')
  const organization = frameworkScope.substr(1)

  core.debug(
    `removing GitHub package ${packageName} version ${packageVersion} from organization ${organization}`
  )
  const octokit = getOctokit(registryToken)

  const {
    data: versions,
  } = await octokit.packages.getAllPackageVersionsForAPackageOwnedByAnOrg({
    org: organization,
    package_name: packageName,
    package_type: 'npm',
  })

  if (versions.length === 1) {
    core.debug(`this is last version, removing package itself`)
    await octokit.packages.deletePackageForOrg({
      org: organization,
      package_type: 'npm',
      package_name: packageName,
    })
    core.debug(`GitHub package removed`)
    return
  }

  const version = versions.find((v) => v.name === packageVersion)
  if (version == null) {
    throw Error(
      `unable to get package ${packageName} version ${packageVersion} identifier`
    )
  }

  const { id } = version
  core.debug(`retrieved version identifier: ${id}`)

  await octokit.packages.deletePackageVersionForOrg({
    org: organization,
    package_type: 'npm',
    package_name: packageName,
    package_version_id: id,
  })
  core.debug(`GitHub package version removed`)
}

const unpublishPackage = async (
  packageName: string,
  packageVersion: string
) => {
  const isGithubRegistry = parseBoolean(core.getState('is_github_registry'))
  isGithubRegistry
    ? await unpublishFromGithubRegistry(packageName, packageVersion)
    : exec(`npm unpublish --force ${packageName}@${packageVersion}`)
}

export const unpublish = async (
  version: string,
  packageLocation = '.'
): Promise<void> => {
  const publishedVersion = semver.parse(version)
  if (!publishedVersion) {
    throw Error(`invalid publish version: ${version}`)
  }

  const pkg = JSON.parse(readString(`${packageLocation}/package.json`))

  const { name, private: restricted } = pkg

  if (restricted) {
    return
  }

  try {
    await unpublishPackage(name, publishedVersion.version)
  } catch (error) {
    core.warning(`Unpublish error: ${error.message}`)
  }
}
