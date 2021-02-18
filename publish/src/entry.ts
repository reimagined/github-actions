import * as core from '@actions/core'
import minimist from 'minimist'
import { publish } from './publish'

export const entry = async (): Promise<void> => {
  const args = minimist(process.argv.slice(2))
  const command = args._.length ? args._[0] : ''

  if (command === 'publish') {
    return await publish(args.version, args.tag)
  }

  core.info(``)

  core.debug(`message from action!`)
  core.debug(`another message!`)
  // eslint-disable-next-line no-console
  console.log(`action output!`)
}
