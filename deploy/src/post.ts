import * as core from '@actions/core'
import { getCLI } from '../../common/src/cli'
import { parseBoolean } from '../../common/src/utils'

export const post = async (): Promise<void> => {
  const id = core.getState('app_id')
  const dir = core.getState('app_dir')
  const retrieveLogs = parseBoolean(core.getInput('retrieve_logs'))

  if (!parseBoolean(core.getInput('skip_remove'))) {
    if (id != null && dir != null) {
      try {
        core.startGroup(`removing cloud deployment: ${id}`)
        const cli = getCLI(dir, core.getInput('cli_sources'))
        if (retrieveLogs) {
          try {
            core.debug(`=== EVENT SUBSCRIBERS ====`)
            cli(`read-models ${id}`, `inherit`)
          } catch (error) {
            core.warning(error)
          }
          try {
            core.debug(`=== DEPLOYMENT LOGS ====`)
            cli(`logs ${id}`, `inherit`)
          } catch (error) {
            core.warning(error)
          }
        }

        cli(`rm ${id} --with-event-store`, 'inherit')
        core.endGroup()
      } catch (error) {
        core.warning(error)
      }
    }
  }
}
