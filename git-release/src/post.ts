import * as core from '@actions/core'
import * as path from 'path'
import { parseBoolean } from '../../common/src/utils'
import { getGit } from '../../common/src/git'

export const post = async (): Promise<void> => {
  const success = parseBoolean(core.getState('success'))
  const git = getGit(path.resolve('./'), undefined, core)

  const versionBranch = core.getState('version_branch')
  const releaseBranch = core.getInput('release_branch')

  try {
    if (success) {
      core.info(`successful release, performing tagging and back-merging`)
      const devBranch = core.getInput('development_branch')
      const versionTag = core.getState('version_tag')

      core.startGroup(`commit release`)
      core.debug(`checking out ${releaseBranch}`)
      git(`checkout ${releaseBranch}`)

      core.debug(`merging ${versionBranch} to ${releaseBranch}`)
      git(`merge -m "merge release version branch" ${versionBranch}`)

      core.debug(`pushing ${releaseBranch} to remote`)
      git(`push`)

      core.debug(`tagging with annotated tag ${versionTag}`)
      git(`tag --annotate ${versionTag} --message ${versionTag}`)

      core.debug(`pushing tag to remote`)
      git(`push --tags`)

      core.debug(`checking out ${devBranch}`)
      git(`checkout ${devBranch}`)

      core.debug(`pulling ${devBranch} from remote`)
      git(`pull`)

      core.debug(`merging ${releaseBranch} to ${devBranch}`)
      git(`merge -m "merge release version branch" ${releaseBranch}`)

      core.debug(`pushing ${devBranch} to remote`)
      git(`push`)
      core.endGroup()

      core.info(`${versionTag} released successfully`)
    } else {
      core.warning(`failed release, cleanup git mess`)

      core.startGroup('cleanup')

      core.debug(`checking out ${releaseBranch}`)
      git(`checkout ${releaseBranch}`)

      core.error(`${versionBranch} release failed!`)
    }
  } finally {
    core.debug(`anyway deleting remote ${versionBranch}`)
    git(`push origin --delete refs/heads/${versionBranch}`)
  }
}
