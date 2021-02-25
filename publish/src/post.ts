import * as core from '@actions/core'
import { unlinkSync, copyFileSync } from 'fs'
import { unpublish } from './unpublish'
import { processWorkspaces, parseBoolean } from '../../common/src/utils'

export const post = async (): Promise<void> => {
  if (parseBoolean(core.getInput('unpublish'))) {
    const version = core.getState('version')
    if (!version) {
      throw Error(`missing packages version to unpublish`)
    }

    core.info('removing published packages from the registry')

    await processWorkspaces(async (w) => {
      core.debug(`[${w.name}] executing unpublish`)
      await unpublish(version, w.location)
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
