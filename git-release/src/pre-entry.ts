/* istanbul ignore file */
import * as core from '@actions/core'
import { pre } from './pre'

pre().catch((error) => {
  core.setFailed(error)
  process.exit(1)
})
