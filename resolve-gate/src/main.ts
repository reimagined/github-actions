import { URL } from 'url'
import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import semver from 'semver'

import {
  writeNpmRc,
  parseScopes,
  createExecutor,
  bumpDependencies,
} from '../../common/src/utils'
import { Package } from '../../common/src/types'
import { writeResolveRc } from '../../common/src/cli'

const readPackage = (file: string): Package =>
  JSON.parse(readFileSync(file).toString('utf-8'))

export const main = async (): Promise<void> => {
  const appDir = path.resolve(
    process.cwd(),
    core.getInput('source', { required: true })
  )
  core.debug(`application directory: ${appDir}`)
  const commandExecutor = createExecutor(appDir)

  const registry = core.getInput('registry', { required: true })
  const token = core.getInput('token', { required: true })
  const scopes = parseScopes(core.getInput('framework_scope'))

  const pkgFile = path.resolve(appDir, './package.json')
  const pkg = readPackage(pkgFile)

  let registryURL: URL
  try {
    registryURL = new URL(registry)
  } catch (error) {
    core.debug(`invalid registry URL: "${registry}"`)
    throw Error(error.message)
  }
  writeNpmRc(path.resolve(appDir, '.npmrc'), registryURL, token, {
    scopes,
    core,
  })

  let frameworkVersion = core.getInput('framework_version')

  if (frameworkVersion == null || frameworkVersion.trim().length === 0) {
    if (pkg.dependencies == null) {
      throw new Error(`Failed to get package ${pkg.name} dependencies`)
    }

    const resolvePackage = Object.keys(pkg.dependencies).find((dependency) =>
      dependency.startsWith('@resolve-js/')
    )

    const { data } = JSON.parse(
      commandExecutor(
        `yarn -s info ${resolvePackage} dist-tags --json`
      ).toString()
    )

    const registryPackageTag = core.getInput('registry_package_tag')

    if (registryPackageTag == null || registryPackageTag.trim().length === 0) {
      throw new Error(`Failed to get registry package tag`)
    }

    frameworkVersion = data[registryPackageTag]
  }

  if (!semver.parse(frameworkVersion)) {
    throw new Error(`Incorrect specified version "${frameworkVersion}"`)
  }

  core.debug(`patching framework version to ${frameworkVersion}`)
  const updatedConfig = bumpDependencies(
    pkg,
    `${core.getInput('framework_scope')}/.*$`,
    frameworkVersion
  )

  core.debug(`writing patched: ${pkgFile}`)
  const content = JSON.stringify(updatedConfig, null, 2)
  core.debug(content)
  writeFileSync(pkgFile, content)

  writeResolveRc(
    path.resolve(appDir, '.resolverc'),
    core.getInput('cloud_user', { required: true }),
    core.getInput('cloud_token', { required: true }),
    core.getInput('cloud_api_url'),
    core
  )

  core.info(`installing application dependencies`)

  commandExecutor(`npm install`)

  commandExecutor(`node ./ci-scripts/resolve-gate/run-task.js`)
}
