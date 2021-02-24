import * as path from 'path'
import * as core from '@actions/core'
import { readFileSync, writeFileSync } from 'fs'
import { bumpDependencies } from '../../common/src/utils'

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

export const main = async (): Promise<void> => {
  const appDir = path.resolve(process.cwd(), core.getInput('source'))
  core.debug(`application directory: ${appDir}`)

  const frameworkVersion = core.getInput('framework_version')
  if (frameworkVersion != null && frameworkVersion.trim().length) {
    core.debug(`patching framework version to ${frameworkVersion}`)
    const pkgFile = path.resolve(appDir, './package.json')
    const pkg = bumpDependencies(
      JSON.parse(readString(pkgFile)),
      '@reimagined/.*$',
      frameworkVersion
    )
    writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
    core.debug(`framework version set`)
  }

  /*
  const npmRegistry = ensureHttp(core.getInput('npm_registry'))
  if (npmRegistry) {
    writeNpmRc(appDir, npmRegistry)
  }

  console.log(`installing packages within ${appDir}`)

  execSync('yarn install --frozen-lockfile', {
    cwd: appDir,
    stdio: 'inherit',
  })

  const inputAppName = core.getInput('app_name')
  const generateName = isTrue(core.getInput('generate_app_name'))

  let targetAppName = ''
  if (generateName) {
    const source = inputAppName !== '' ? inputAppName : readAppPackage().name
    targetAppName = randomize(source)
  } else if (inputAppName !== '') {
    targetAppName = inputAppName
  }

  console.debug(`target application path: ${appDir}`)
  console.debug(`target application name: ${targetAppName}`)

  const localMode = isTrue(core.getInput('local_mode'))

  if (!localMode) {
    makeResolveRC(
      appDir,
      core.getInput('resolve_api_url'),
      core.getInput('resolve_user'),
      core.getInput('resolve_token')
    )
  }

  const customArgs = core.getInput('deploy_args')

  console.debug(`deploying application to the cloud`)

  let baseArgs = ''
  baseArgs += targetAppName ? ` --name ${targetAppName}` : ''
  baseArgs += npmRegistry ? ` --npm-registry ${npmRegistry}` : ''

  try {
    resolveCloud(`deploy ${baseArgs} ${customArgs}`, 'inherit')
    console.debug('the application deployed successfully')
  } finally {
    console.debug(`retrieving deployed application metadata`)

    const { deploymentId, appName, appRuntime, appUrl } = describeApp(
      targetAppName,
      resolveCloud
    )

    core.setOutput('deployment_id', deploymentId)
    core.setOutput('app_name', appName)
    core.setOutput('app_runtime', appRuntime)
    core.setOutput('app_url', appUrl)

    core.saveState(`deployment_id`, deploymentId)
    core.saveState(`app_dir`, appDir)
  }
   */
  return Promise.resolve()
}
