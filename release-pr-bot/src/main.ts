import * as core from '@actions/core'
import * as github from '@actions/github'

export const main = (): Promise<void> => {
  const event = core.getInput('event')

  core.debug(event)

  return Promise.resolve()
}
