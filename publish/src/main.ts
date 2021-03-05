import { URL } from 'url'
import isEmpty from 'lodash.isempty'
import * as core from '@actions/core'
import * as path from 'path'
import * as os from 'os'
import { readFileSync } from 'fs'
import { publish } from './publish'
import {
  processWorkspaces,
  writeNpmRc,
  restoreNpmRc,
} from '../../common/src/utils'
import semver from 'semver'
import { Package } from '../../common/src/types'

const readPackage = (): Package =>
  JSON.parse(readFileSync(path.resolve('./package.json')).toString('utf-8'))

const isGitHubRegistry = (url: URL): boolean =>
  url.host.toLowerCase() === 'npm.pkg.github.com'

const determineOwner = (pkg: Package): string => {
  const owner = core.getInput('owner')

  if (!owner) {
    const { name } = pkg
    if (!name.startsWith('@')) {
      throw Error(`unable to determine GitHub owner from package name: ${name}`)
    }
    return name.slice(1).split('/')[0]
  }

  return owner
}

const limitLength = (src?: string): string | undefined => {
  if (src != null && src.length > 6) {
    return src.substr(0, 6)
  }
  return src
}

const determineRegistry = (): URL => {
  const registry = core.getInput('registry')

  switch (registry.toLowerCase()) {
    case 'github':
      return new URL(
        `https://npm.pkg.github.com/${determineOwner(readPackage())}`
      )
    case 'npm':
    case 'npmjs':
      return new URL('https://registry.npmjs.org')
    default:
      try {
        return new URL(registry)
      } catch (error) {
        throw Error(`invalid input [registry]: ${error.message}`)
      }
  }
}

const determineVersion = (): string => {
  const version = core.getInput('version', { required: true })
  switch (version.toLowerCase()) {
    case 'auto':
      const pkg = readPackage()
      const build =
        limitLength(core.getInput('build')) ??
        new Date().toISOString().replace(/[:.]/gi, '-')
      return `${pkg.version}-${build}`

    case 'source':
      return readPackage().version

    default:
      if (!semver.parse(version)) {
        throw Error(`invalid version: ${version}`)
      }
      return version
  }
}

export const main = async (): Promise<void> => {
  core.info(`configuring registry`)

  const registryURL = determineRegistry()
  core.debug(`registry URL: ${registryURL}`)

  const registryToken = core.getInput('token', { required: true })
  core.debug(`registry token obtained`)

  const npmRc = path.resolve(os.homedir(), '.npmrc')
  core.debug(`npmrc file path: ${npmRc}`)

  const npmRcBackup = writeNpmRc(npmRc, registryURL, registryToken, {
    createBackup: true,
    core,
  })

  const version = determineVersion()
  core.debug(`determined publish version: ${version}`)
  const tag = core.getInput('tag')

  core.info(`publishing packages to ${registryURL.host}`)

  core.saveState('version', version)
  core.saveState('tag', tag)

  const isGitHub = isGitHubRegistry(registryURL)
  core.saveState('registry_url', registryURL.href)
  core.saveState('registry_token', registryToken)
  core.saveState('npmrc_path', npmRc)
  core.saveState('is_github_registry', isGitHub)

  try {
    await processWorkspaces(async (w) => {
      const { pkg, location, name } = w

      if (pkg.private) {
        core.debug(`[${name}] the package is private, skipping processing`)
        return
      }
      let repository: string | undefined
      if (isGitHub) {
        repository = core.getInput('github_target_repository')
        const targetOwner = registryURL.pathname.slice(1)
        if (!targetOwner) {
          core.error(
            `[${name}] unable to determine target github owner from registry URL, aborting all`
          )
          throw Error(`invalid GitHub registry URL`)
        }

        let packageOwner
        try {
          packageOwner = determineOwner(pkg)
        } catch (error) {
          core.warning(
            `[${name}] unable to determine github owner, skipping the package`
          )
          return
        }

        if (packageOwner !== targetOwner) {
          core.warning(
            `[${name}] owner (${packageOwner}) mismatch: target owner (${targetOwner}), skipping the package`
          )
          return
        }

        if (!isEmpty(repository)) {
          const targetRepoOwner = repository.split('/')[0].trim()
          if (targetRepoOwner !== targetOwner) {
            core.warning(
              `[${name}] target repository (${repository}) owner mismatch: target owner (${targetOwner}), skipping the package`
            )
            return
          }
          repository = `https://github.com/${repository}${
            repository.endsWith('.git') ? '' : '.git'
          }`
        }
      }

      core.debug(`[${name}] executing publish`)
      await publish(version, {
        tag,
        location,
        repository,
        frameworkScope: core.getInput('framework_scope'),
      })
    }, core.debug)
  } finally {
    restoreNpmRc(npmRc, npmRcBackup, core)
  }

  core.setOutput('registry_url', registryURL.href)
  core.setOutput('version', version)
  core.setOutput('tag', tag)

  core.info('all done')
}
