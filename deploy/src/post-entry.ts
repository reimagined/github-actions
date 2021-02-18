/* istanbul ignore file */
import * as core from '@actions/core'
import { post } from './post'

post().catch((error) => {
  core.setFailed(error)
  process.exit(1)
})
