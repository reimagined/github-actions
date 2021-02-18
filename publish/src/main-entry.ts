/* istanbul ignore file */
import * as core from '@actions/core'
import { main } from './main'

main().catch((error) => {
  core.setFailed(error)
  process.exit(1)
})
