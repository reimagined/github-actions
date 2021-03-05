import * as core from '@actions/core'

export const main = async (): Promise<void> => {
  const version = core.getState('version')
  core.debug(`confirm success  ${version} release`)
  core.saveState('success', true)
}
