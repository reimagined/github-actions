import * as core from '@actions/core'
import { entry } from './entry'

entry().catch((error) => {
  core.error(error)
  process.exit(1)
})
