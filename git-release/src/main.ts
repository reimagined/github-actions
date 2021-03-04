import * as core from '@actions/core'
import { registerPrivateKey } from '../../common/src/ssh'

export const main = async (): Promise<void> => {
  registerPrivateKey(core.getInput('ssh_private_key', { required: true }))

  return
}
