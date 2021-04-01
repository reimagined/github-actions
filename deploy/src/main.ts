import { URL } from 'url'
import * as path from 'path'
import * as core from '@actions/core'
import setByPath from 'lodash.set'
import unsetByPath from 'lodash.unset'
import isEmpty from 'lodash.isempty'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import latestVersion from 'latest-version'
import * as os from 'os'
import { Package } from '../../common/src/types'
import {
  bumpDependencies,
  parseBoolean,
  parseScopes,
  writeNpmRc,
} from '../../common/src/utils'
import { describeApp, getCLI, writeResolveRc } from '../../common/src/cli'

const readPackage = (file: string): Package =>
  JSON.parse(readFileSync(file).toString('utf-8'))

const randomize = (str: string): string =>
  `${str}-${Math.floor(Math.random() * 1000000)}`

export const main = async (): Promise<void> => {
  const appDir = path.resolve(
    process.cwd(),
    core.getInput('source', { required: true })
  )
  core.debug(`application directory: ${appDir}`)
  const pkgFile = path.resolve(appDir, './package.json')
  let pkg = readPackage(pkgFile)

  const frameworkVersion = core.getInput('framework_version')
  if (frameworkVersion != null && frameworkVersion.trim().length) {
    core.debug(`patching framework version to ${frameworkVersion}`)
    pkg = bumpDependencies(
      pkg,
      `${core.getInput('framework_scope')}/.*$`,
      frameworkVersion
    )
  }

  const cliSources = core.getInput('cli_sources')
  const specificCliVersion = core.getInput('cli_version')

  if (!isEmpty(cliSources) && !isEmpty(specificCliVersion)) {
    throw Error(
      `[cli_version] and [cli_sources] options cannot be used at the same time`
    )
  }

  if (isEmpty(cliSources)) {
    const cliVersion = isEmpty(specificCliVersion)
      ? await latestVersion('resolve-cloud')
      : specificCliVersion

    core.debug(`setting cloud CLI version to (${cliVersion})`)
    setByPath(pkg, 'devDependencies.resolve-cloud', cliVersion)
  } else {
    unsetByPath(pkg, 'devDependencies.resolve-cloud')
  }

  core.debug(`writing patched: ${pkgFile}`)
  const content = JSON.stringify(pkg, null, 2)
  core.debug(content)
  writeFileSync(pkgFile, content)

  const registry = core.getInput('package_registry')
  if (registry != null) {
    let registryURL: URL
    try {
      registryURL = new URL(registry)
    } catch (error) {
      core.debug(`invalid registry URL: ${registry}`)
      throw Error(error.message)
    }
    writeNpmRc(
      path.resolve(appDir, '.npmrc'),
      registryURL,
      core.getInput('package_registry_token'),
      {
        scopes: parseScopes(core.getInput('package_registry_scopes')),
        core,
      }
    )
  }

  core.info(`installing application dependencies`)

  execSync(`yarn install --frozen-lockfile`, {
    cwd: appDir,
    stdio: 'inherit',
  })

  const randomizer = parseBoolean(core.getInput('randomize_name'))
    ? randomize
    : (val) => val

  const inputAppName = core.getInput('name')
  core.debug(`input app name: ${inputAppName}`)

  const targetAppName = randomizer(
    isEmpty(inputAppName) ? readPackage(pkgFile).name : inputAppName
  )
  core.debug(`target application name: ${targetAppName}`)
  core.debug(`target application path: ${appDir}`)

  if (!parseBoolean(core.getInput('local_run'))) {
    writeResolveRc(
      path.resolve(appDir, '.resolverc'),
      core.getInput('cloud_user', { required: true }),
      core.getInput('cloud_token', { required: true }),
      core.getInput('cloud_api_url'),
      core
    )
  }

  const customArgs = core.getInput('deploy_args') || ''

  const cli = getCLI(appDir, cliSources)
  const eventsFilePath = core.getInput('events_file_path')

  try {
    let eventStoreId: string | null = null

    if (eventsFilePath != null) {
      core.debug(`events file path is specified. creating event-store`)

      eventStoreId = cli(`event-stores create --format "{{ eventStoreId }}"`, [
        'inherit',
        'pipe',
      ]).trim()

      core.debug(`event-store created`)

      if (eventStoreId == null) {
        throw new Error('Event store ID is not found in the output')
      }

      core.debug(`importing initial events into event-store`)

      cli(
        `event-stores incremental-import ${eventStoreId} ${eventsFilePath}`,
        'inherit'
      )

      core.debug(`initial events imported`)
    }

    const deployCommandParts = ['deploy', `--name ${targetAppName}`]

    if (eventStoreId) {
      deployCommandParts.push(`--event-store-id ${eventStoreId}`)
    }

    deployCommandParts.push(customArgs)
    const deployCommand = deployCommandParts.filter(Boolean).join(' ')

    core.debug(`deploying the application to the cloud`)
    cli(deployCommand, 'inherit')
    core.debug('the application deployed successfully')
  } catch (e) {
    core.error(`deploy failed: ${e.toString()}`)
    throw e
  } finally {
    core.debug(`retrieving deployed application metadata`)

    const deployment = describeApp(targetAppName, cli, core)

    if (deployment != null) {
      const { id, name, runtime, url, eventStoreId } = deployment

      core.setOutput('id', id)
      core.setOutput('name', name)
      core.setOutput('runtime', runtime)
      core.setOutput('url', url)
      core.setOutput('event_store_id', eventStoreId)

      core.saveState(`app_id`, id)
      core.saveState(`app_dir`, appDir)
    } else {
      core.error(`could not find cloud deployment for the app`)
    }
  }
}
