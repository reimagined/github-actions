import * as core from '@actions/core'
import { exec } from 'child_process'
import { unlinkSync, copyFileSync } from 'fs'
import minimist from 'minimist'
import { unpublish } from './unpublish'
import { processWorkspaces } from '../../common/src/utils'

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
    if (!version) {
      throw Error(`missing packages version to unpublish`)
    }

    core.info('removing published packages from the registry')

    await processWorkspaces(async (w) => {
      await new Promise((resolve, reject) => {
        core.debug(`[${w.name}] executing unpublish script`)
        exec(
          `${process.argv[0]} ${process.argv[1]} unpublish --version=${version}`,
          {
            cwd: w.location,
          },
          (error, stdout, stderr) => {
            if (error) {
              return reject(
                Error(`${error.message}:\nstderr:${stderr}\nstdout:${stdout}`)
              )
            }
            if (stdout) {
              core.debug(stdout)
            }
            resolve(stdout)
          }
        )
      })
    }, core.debug)
  }

  const npmRc = core.getState('npmrc_file')
  if (npmRc) {
    core.info(`removing ${npmRc}`)
    unlinkSync(npmRc)
  }

  const npmRcBackup = core.getState('npmrc_backup')
  if (npmRc && npmRcBackup) {
    core.info(`restoring npmrc from ${npmRcBackup}`)
    copyFileSync(npmRcBackup, npmRc)
    unlinkSync(npmRcBackup)
  }
}
