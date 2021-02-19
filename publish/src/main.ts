import { URL } from 'url'
import * as core from '@actions/core'
import * as path from 'path'
import * as os from 'os'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, existsSync, copyFileSync } from 'fs'
import minimist from 'minimist'
import { publish } from './publish'
import { processWorkspaces } from './utils'
import semver from 'semver'
import { Package } from './types'

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
  if (version.toLowerCase() === 'auto') {
    const pkg = readPackage()
    const build =
      core.getInput('build') ?? new Date().toISOString().replace(/[:.]/gi, '-')
    return `${pkg.version}-${build}`
  }

  if (!semver.parse(version)) {
    throw Error(`invalid version: ${version}`)
  }

  return version
}

const writeNpmRc = (
  file: string,
  registry: URL,
  token: string
): string | null => {
  let backupFile = null
  if (existsSync(file)) {
    backupFile = path.resolve(path.dirname(file), '._build_npmrc_orig_')
    core.info(`npmrc file exists, backing up to: ${backupFile}`)
    copyFileSync(file, backupFile)
  }

  core.debug(`writing ${file}`)
  writeFileSync(
    file,
    `//${registry.host}/:_authToken=${token}\n` +
      `//${registry.host}/:always-auth=true\n` +
      `registry=${registry.href}\n`
  )
  return backupFile
}

export const main = async (): Promise<void> => {
  const args = minimist(process.argv.slice(2))
  const command = args._.length ? args._[0] : ''

  if (command === 'publish') {
    core.info(`starting in "publish" mode`)
    return await publish(args.version, args.tag)
  }

  core.info(`configuring registry`)

  const registryURL = determineRegistry()
  core.debug(`registry URL: ${registryURL}`)

  const registryToken = core.getInput('token', { required: true })
  core.debug(`registry token obtained`)

  const npmRc = path.resolve(os.homedir(), '.npmrc')
  core.debug(`npmrc file path: ${npmRc}`)

  const npmRcBackup = writeNpmRc(npmRc, registryURL, registryToken)

  core.saveState('npmrc_file', npmRc)
  if (npmRcBackup != null) {
    core.saveState('npmrc_backup', npmRcBackup)
  }

  const version = determineVersion()
  core.debug(`determined publish version: ${version}`)
  const tag = core.getInput('tag')

  core.info(`publishing packages to ${registryURL.host}`)

  core.saveState('version', version)
  core.saveState('tag', tag)

  await processWorkspaces(async (w) => {
    const { pkg, location, name } = w

    if (pkg.private) {
      core.debug(`[${name}] the package is private, skipping processing`)
      return
    }

    if (isGitHubRegistry(registryURL)) {
      const targetOwner = registryURL.pathname.slice(1)
      if (!targetOwner) {
        core.error(
          `[${name}] unable to determine target github owner from registry URL, aborting all`
        )
        throw Error(`invalid github registry URL`)
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
    }

    await new Promise((resolve, reject) => {
      core.debug(`[${name}] executing publish script`)
      exec(
        `${process.argv[0]} ${process.argv[1]} publish --version=${version}${
          tag ? ` --tag=${tag}` : ''
        }`,
        {
          cwd: location,
        },
        (error, stdout, stderr) => {
          if (error) {
            return reject(
              Error(`${error.message}:\nstderr:${stderr}\nstdout:${stdout}`)
            )
          }
          if (stdout) {
            core.debug(stdout)
          }
          resolve(stdout)
        }
      )
    })
  }, core.debug)

  core.setOutput('registry_url', registryURL.href)
  core.setOutput('version', version)
  core.setOutput('tag', tag)

  core.info('all done')
}
