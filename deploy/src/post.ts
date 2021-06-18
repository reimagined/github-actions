import * as core from '@actions/core'
import { getCLI } from '../../common/src/cli'
import { parseBoolean } from '../../common/src/utils'

export const post = async (): Promise<void> => {
  const id = core.getState('app_id')
  const dir = core.getState('app_dir')
  if (!parseBoolean(core.getInput('skip_remove'))) {
    if (id != null && dir != null) {
      try {
        core.startGroup(`removing cloud deployment: ${id}`)
        const cli = getCLI(dir, core.getInput('cli_sources'))
        cli(`rm ${id} --with-event-store`, 'inherit')
        core.endGroup()
      } catch (error) {
        core.warning(error)
      }
    }
  }
}
