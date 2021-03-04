import * as core from '@actions/core'
import { getGit } from '../../common/src/git'

export const main = async (): Promise<void> => {
  const git = getGit(core.getInput('ssh_private_key', { required: true }), core)

  return
}
