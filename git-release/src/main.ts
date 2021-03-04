import * as core from '@actions/core'
import * as path from 'path'
import { registerPrivateKey } from '../../common/src/ssh'

export const main = async (): Promise<void> => {
  registerPrivateKey(
    core.getInput('ssh_private_key', { required: true }),
    path.resolve('bot-github-rsa'),
    core
  )

  return
}
