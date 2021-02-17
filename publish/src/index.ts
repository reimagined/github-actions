import * as core from '@actions/core'

export const entry = (): void => {
  core.debug(`message from action!`)
  core.debug(`another message!`)
}

entry()
