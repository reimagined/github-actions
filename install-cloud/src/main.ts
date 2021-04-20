import { URL } from 'url'
import { writeFileSync, readFileSync } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as semver from 'semver'
import {
  processWorkspaces,
  bumpDependencies,
  writeNpmRc,
  parseScopes,
  createExecutor,
} from '../../common/src/utils'

export const main = async (): Promise<void> => {
  const awsAccessKeyId = core.getInput('aws_access_key_id', { required: true })
  const awsSecretAccessKey = core.getInput('aws_secret_access_key', {
    required: true,
  })
  const source = core.getInput('source', { required: true })
  const stage = core.getInput('stage', { required: true })

  const registry = core.getInput('registry')
  const token = core.getInput('token')
  const scopes = parseScopes(core.getInput('scopes'))

  if (registry != null) {
    let registryURL: URL
    try {
      registryURL = new URL(registry)
    } catch (error) {
      core.debug(`invalid registry URL: ${registry}`)
      throw Error(error.message)
    }
    writeNpmRc(path.resolve(source, '.npmrc'), registryURL, token, {
      scopes,
      core,
    })
  }

  let versionSource = core.getInput('version')
  let determinedVersion: string
  const bumpVersion = semver.parse(versionSource)
  if (bumpVersion) {
    determinedVersion = bumpVersion.version
    await processWorkspaces(
      async (w) => {
        const { pkg, location } = w

        writeFileSync(
          path.resolve(location, './package.json'),
          JSON.stringify(
            bumpDependencies(
              pkg,
              `${core.getInput('framework_scope')}/.*$`,
              determinedVersion
            ),
            null,
            2
          )
        )
      },
      core.debug,
      source
    )
  } else {
    if (versionSource != null && versionSource.trim().length) {
      throw Error(`Invalid [version] non-empty input value: ${versionSource}`)
    }
    core.debug(`no version input, reading from source package.json`)
    const { version } = JSON.parse(
      readFileSync(path.resolve(source, './package.json')).toString('utf-8')
    )
    determinedVersion = version
  }

  const commandExecutor = createExecutor(source, {
    AWS_ACCESS_KEY_ID: awsAccessKeyId,
    AWS_SECRET_ACCESS_KEY: awsSecretAccessKey,
  })

  commandExecutor(`yarn install`)
  commandExecutor(`yarn build-assets`)
  commandExecutor(`yarn -s admin-cli stage-resources install --stage=${stage}`)
  commandExecutor(
    `yarn -s admin-cli version-resources install --stage=${stage} --version=${determinedVersion}`
  )

  core.saveState(`determined_version`, determinedVersion)

  const apiUrl = commandExecutor(
    `yarn -s admin-cli get-api-url --stage=${stage} --skip-logs`,
    'pipe'
  )
    .toString()
    .trim()

  core.setOutput('api_url', apiUrl)

  const {
    eventStoreClusterArn,
    readModelsClusterArn,
    systemClusterArn,
    systemDatabaseName,
    postgresAdminUsername,
    postgresAdminPassword,
    postgresAdminSecretName,
    postgresAdminSecretArn,
  } = JSON.parse(
    commandExecutor(
      `yarn -s admin-cli rds describe --stage=${stage} --skip-logs`,
      'pipe'
    )
      .toString()
      .trim()
  )

  core.setOutput('event_store_cluster_arn', eventStoreClusterArn)
  core.setOutput('read_models_cluster_arn', readModelsClusterArn)
  core.setOutput('system_cluster_arn', systemClusterArn)
  core.setOutput('system_database_name', systemDatabaseName)
  core.setOutput('postgres_admin_username', postgresAdminUsername)
  core.setOutput('postgres_admin_password', postgresAdminPassword)
  core.setOutput('postgres_admin_secret_name', postgresAdminSecretName)
  core.setOutput('postgres_admin_secret_arn', postgresAdminSecretArn)
}
