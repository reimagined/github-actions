import { execSync, StdioOptions } from 'child_process'
import * as core from '@actions/core'

const createExecutor = (path: string) => (
  args: string,
  stdio: StdioOptions = 'inherit'
): Buffer =>
  execSync(args, {
    cwd: path,
    stdio,
    env: {
      ...process.env,
    },
  })

try {
  const path = core.getInput('path')
  const stage = core.getInput('stage_name')
  const version = core.getInput('version')
  const awsAccessKeyId = core.getInput('aws_access_key_id')
  const awsSecretAccessKey = core.getInput('aws_secret_access_key')

  if (!/^\d\.\d\.\d(-.\w)?$/.test(version)) {
    throw new Error('wrong version pattern (1.2.3, 0.0.1-alpha)')
  }

  const commandExecutor = createExecutor(path)

  process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey

  commandExecutor(`yarn bump-version --version=${version}`)
  commandExecutor(`yarn install`)

  commandExecutor(`yarn -s admin-cli stage-resources install --stage=${stage}`)
  commandExecutor(
    `yarn -s admin-cli version-resources install --stage=${stage} --version=${version}`
  )

  const apiUrl = commandExecutor(
    `yarn -s admin-cli get-api-url --stage=${stage}`,
    'pipe'
  )
    .toString()
    .trim()

  core.setOutput('api_url', apiUrl)
} catch (error) {
  core.setFailed(error)
}
