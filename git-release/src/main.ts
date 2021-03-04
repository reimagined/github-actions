import * as core from '@actions/core'

export const main = async (): Promise<void> => {
  const version = core.getState('version')
  core.debug(`completing release ${version}`)
  core.saveState('success', true)
}
