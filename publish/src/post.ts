import * as core from '@actions/core'
import { execSync } from 'child_process'
import { unlinkSync } from 'fs'
import minimist from 'minimist'
import { unpublish } from './unpublish'

const isTrue = (value: string) =>
  value != null && ['yes', 'true', '1'].includes(value.toLowerCase())

export const post = async (): Promise<void> => {
  const args = minimist(process.argv.slice(2))
  const command = args._.length ? args._[0] : ''

  if (command === 'unpublish') {
    return await unpublish(args.version)
  }

  if (isTrue(core.getInput('unpublish'))) {
    const version = core.getState('version')

    core.info('removing published packages from the registry')

    execSync(
      `yarn workspaces run "${process.argv[0]} ${process.argv[1]} unpublish --version=${version}"`,
      {
        stdio: 'inherit',
      }
    )
  }

  const npmRc = core.getState('npmrc_file')
  if (npmRc) {
    core.info(`removing ${npmRc}`)
    unlinkSync(npmRc)
  }
}
