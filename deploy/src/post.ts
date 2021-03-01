import * as core from '@actions/core'
import { execSync } from 'child_process'

export const post = async (): Promise<void> => {
  const id = core.getState('app_id')

  try {
    core.info(`removing cloud application ${id}`)
    execSync(`yarn --silent resolve-cloud remove ${id} --no-wait`, {
      stdio: 'inherit',
    })
  } catch (error) {
    core.warning(error)
  }
}
