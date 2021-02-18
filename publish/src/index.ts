import * as core from '@actions/core'
import { entry } from './entry'

entry().catch((error) => {
  core.setFailed(error)
  process.exit(1)
})
