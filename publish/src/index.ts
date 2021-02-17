import core from '@actions/core'

export const entry = (): void => {
  core.debug('do stuff')
  core.debug('some update')
  core.debug('again')
}

entry()
