import * as core from '@actions/core'
import { execSync } from 'child_process'

export const post = async (): Promise<void> => {
  const deploymentId = core.getState('deployment_id')

  try {
    core.info(`removing cloud application ${deploymentId}`)
    execSync(`yarn --silent resolve-cloud remove ${deploymentId} --no-wait`, {
      stdio: 'inherit',
    })
  } catch (error) {
    core.warning(error)
  }
}
