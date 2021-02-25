import { URL } from 'url'
import * as path from 'path'
import * as core from '@actions/core'
import setByPath from 'lodash.set'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import latestVersion from 'latest-version'
import { Package } from '@reimagined/github-actions-common'

const readPackage = (file: string): Package =>
  JSON.parse(readFileSync(file).toString('utf-8'))

const randomize = (str: string): string =>
  `${str}-${Math.floor(Math.random() * 1000000)}`

export const main = async (): Promise<void> => {
  const appDir = path.resolve(process.cwd(), core.getInput('source'))
  core.debug(`application directory: ${appDir}`)
  const pkgFile = path.resolve(appDir, './package.json')
  let pkg = readPackage(pkgFile)

  const frameworkVersion = core.getInput('framework_version')
  if (frameworkVersion != null && frameworkVersion.trim().length) {
    core.debug(`patching framework version to ${frameworkVersion}`)
    pkg = bumpDependencies(pkg, '@reimagined/.*$', frameworkVersion)
  }

  const specificCliVersion = core.getInput('cli_version')
  const cliVersion =
    specificCliVersion ?? (await latestVersion('resolve-cloud'))

  core.debug(`setting cloud CLI version to (${cliVersion})`)
  setByPath(pkg, 'devDependencies.resolve-cloud', cliVersion)

  core.debug(`writing patched: ${pkgFile}`)
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))

  const registry = core.getInput('registry')
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
      core.getInput('token'),
      {
        scopes: parseScopes(core.getInput('scopes')),
        core,
      }
    )
  }

  core.info(`installing application dependencies`)

  execSync('yarn install --frozen-lockfile', {
    cwd: appDir,
    stdio: 'inherit',
  })

  const inputAppName = core.getInput('name')
  const generateName = parseBoolean(core.getInput('randomize_name'))

  let targetAppName = ''
  if (generateName) {
    const source =
      inputAppName !== '' ? inputAppName : readPackage(pkgFile).name
    targetAppName = randomize(source)
  } else if (inputAppName !== '') {
    targetAppName = inputAppName
  }

  core.debug(`target application path: ${appDir}`)
  core.debug(`target application name: ${targetAppName}`)

  /*
  const localMode = parseBoolean(core.getInput('local_mode'))

  if (!localMode) {
    makeResolveRC(
      appDir,
      core.getInput('resolve_api_url'),
      core.getInput('resolve_user'),
      core.getInput('resolve_token')
    )
  }
  */

  const customArgs = core.getInput('deploy_args')

  core.debug(`deploying the application to the cloud`)

  let baseArgs = ''
  baseArgs += targetAppName ? ` --name ${targetAppName}` : ''

  const cli = getCLI(appDir)

  try {
    cli(`deploy ${baseArgs} ${customArgs}`, 'inherit')
    core.debug('the application deployed successfully')
  } finally {
    core.debug(`retrieving deployed application metadata`)

    const deployment = describeApp(targetAppName, cli)

    if (deployment != null) {
      const { deploymentId, appName, appRuntime, appUrl } = deployment

      core.setOutput('deployment_id', deploymentId)
      core.setOutput('app_name', appName)
      core.setOutput('app_runtime', appRuntime)
      core.setOutput('app_url', appUrl)

      core.saveState(`deployment_id`, deploymentId)
      core.saveState(`app_dir`, appDir)
    } else {
      core.error(`could not find cloud deployment for the app`)
    }
  }
}
