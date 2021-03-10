import * as core from '@actions/core'
import { createExecutor } from '../../common/src/utils'

export const post = async (): Promise<void> => {
  const awsAccessKeyId = core.getInput('aws_access_key_id', { required: true })
  const awsSecretAccessKey = core.getInput('aws_secret_access_key', {
    required: true,
  })
  const source = core.getInput('source', { required: true })
  const stage = core.getInput('stage', { required: true })

  const determinedVersion = core.getState(`determined_version`)

  if (determinedVersion != null) {
    try {
      core.startGroup(`removing cloud version-resources: ${determinedVersion}`)

      const commandExecutor = createExecutor(source, {
        AWS_ACCESS_KEY_ID: awsAccessKeyId,
        AWS_SECRET_ACCESS_KEY: awsSecretAccessKey,
      })

      commandExecutor(
        `yarn -s admin-cli version-resources uninstall --stage=${stage} --version=${determinedVersion}`
      )

      core.endGroup()
    } catch (error) {
      core.warning(error)
    }
  }
}
