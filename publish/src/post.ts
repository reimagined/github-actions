import * as core from '@actions/core'
import { URL } from 'url'
import { unpublish } from './unpublish'
import {
  processWorkspaces,
  restoreNpmRc,
  writeNpmRc,
} from '../../common/src/utils'

const isTrue = (value: string) =>
  value != null && ['yes', 'true', '1'].includes(value.toLowerCase())

export const post = async (): Promise<void> => {
  if (isTrue(core.getInput('unpublish'))) {
    const version = core.getState('version')
    if (!version) {
      throw Error(`missing packages version to unpublish`)
    }

    let npmRcBackup
    let shouldRestoreNpmRc = false
    const registry = core.getState('registry_url')
    const npmRc = core.getState('npmrc_path')

    if (registry != null && npmRc != null) {
      const registryURL = new URL(registry)
      const registryToken = core.getState('registry_token')

      npmRcBackup = writeNpmRc(npmRc, registryURL, registryToken, {
        createBackup: true,
        core,
      })
      shouldRestoreNpmRc = true
    }

    core.info('removing published packages from the registry')

    try {
      await processWorkspaces(async (w) => {
        core.debug(`[${w.name}] executing unpublish`)
        await unpublish(version, w.location)
      }, core.debug)
    } finally {
      if (shouldRestoreNpmRc) {
        restoreNpmRc(npmRc, npmRcBackup, core)
      }
    }
  }
}
