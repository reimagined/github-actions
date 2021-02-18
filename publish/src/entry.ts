import { URL } from 'url'
import * as core from '@actions/core'
import * as path from 'path'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import minimist from 'minimist'
import { publish } from './publish'

const determineRegistry = (): URL => {
  const registry = core.getInput('registry')

  switch (registry.toLowerCase()) {
    case 'github':
      return new URL('https://npm.pkg.github.com')
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

const writeNpmRc = (file: string, registry: URL, token: string) => {
  core.debug(`writing ${file}`)
  writeFileSync(
    file,
    `//${registry.host}/:_authToken=${token}\n` +
      `//${registry.host}/:always-auth=true\n` +
      `registry=${registry.href}\n`
  )
}

export const entry = async (): Promise<void> => {
  const args = minimist(process.argv.slice(2))
  const command = args._.length ? args._[0] : ''

  if (command === 'publish') {
    return await publish(args.version, args.tag)
  }

  core.info(`configuring registry`)

  const registryURL = determineRegistry()
  core.debug(`registry URL: ${registryURL}`)

  const registryToken = core.getInput('token', { required: true })
  core.debug(`registry token: ${registryToken != null ? 'set' : 'not set'}`)

  const npmRc = path.resolve(process.cwd(), '.npmrc')
  core.debug(`npmrc file path: ${npmRc}`)

  writeNpmRc(npmRc, registryURL, registryToken)

  core.saveState('npm_rc_file', npmRc)

  const version = core.getInput('version', { required: true })
  const tag = core.getInput('tag')

  core.info(`publishing packages to ${registryURL.host}`)

  core.saveState('publish_version', version)
  core.saveState('publish_tag', tag)

  execSync(
    `yarn workspaces run "${process.argv[0]} ${process.argv[1]} publish --version=${version} --tag=${tag}"`,
    {
      stdio: 'inherit',
    }
  )

  core.setOutput('registry_url', registryURL.href)
  core.setOutput('version', version)
  core.setOutput('tag', tag)

  core.info('all done')
}
