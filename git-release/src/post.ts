import * as core from '@actions/core'
import { parseBoolean } from '../../common/src/utils'

export const post = async (): Promise<void> => {
  const success = parseBoolean(core.getState('success'))
  if (success) {
    core.info('release succeeded!')
  } else {
    core.warning('release failed!')
  }
}
