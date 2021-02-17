import * as core from '@actions/core'

export const entry = (): void => {
  core.debug(`message from action!`)
  core.debug(`another message!`)
  // eslint-disable-next-line no-console
  console.log(`action output!`)
}

entry()
