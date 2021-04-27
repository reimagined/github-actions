import * as core from '@actions/core'
import * as path from 'path'
import { parseBoolean } from '../../common/src/utils'
import { getGit } from '../../common/src/git'
import { getOctokit } from '@actions/github'
import { readFileSync } from 'fs'
import { PushEvent } from '../../common/src/types'

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
      core.debug(`parsing push event`)
      const event: PushEvent = JSON.parse(
        core.getInput(`push_event`, { required: true })
      )

      core.startGroup(`commit release`)
      core.debug(`checking out ${releaseBranch}`)
      git(`checkout ${releaseBranch}`)

      const commitMessage = core.getState(`version_commit_message`)

      core.debug(`merging squashed ${versionBranch} to ${releaseBranch}`)
      git(`merge --squash ${versionBranch}`)

      core.debug(`committing squashed merge commit`)
      git(`commit -m "${commitMessage}"`)

      core.debug(`pushing ${releaseBranch} to remote`)
      git(`push`)

      core.debug(`checking out ${devBranch}`)
      git(`checkout ${devBranch}`)

      core.debug(`pulling ${devBranch} from remote`)
      git(`pull`)

      core.debug(`merging ${releaseBranch} to ${devBranch}`)
      git(`merge -m "${commitMessage}" ${releaseBranch}`)

      core.debug(`pushing ${devBranch} to remote`)
      git(`push`)

      core.debug(`tagging with annotated tag ${versionTag}`)
      git(`tag --annotate ${versionTag} --message ${versionTag}`)

      core.debug(`pushing tag to remote`)
      git(`push --tags`)
      core.endGroup()

      if (parseBoolean(core.getInput('create_github_release'))) {
        core.startGroup('creating GitHub release')
        let releaseInfo = ''
        try {
          core.debug(`gathering release info`)
          const changelogSlicer = new RegExp(
            `(^## \[${versionTag}\][^\n]*$)(.*?)^(## V[0-9]*.[0-9]*.[0-9])`,
            'gms'
          )
          const changelog = readFileSync('./CHANGELOG.md').toString()
          const slices = changelogSlicer.exec(changelog)
          if (slices != null) {
            releaseInfo = slices[2].trim()
            core.debug(`release info was extracted from CHANGELOG.md`)
          } else {
            core.warning(
              'Changelog slicing failed. Malformed CHANGELOG.md or bad slicing reg exp'
            )
          }
        } catch (e) {
          core.warning(`Changelog processing failed: ${e.message}`)
        }

        core.debug(`creating GitHub release`)
        const octokit = getOctokit(core.getInput('token', { required: true }))
        await octokit.repos.createRelease({
          owner: event.repository.owner.name,
          repo: event.repository.name,
          tag_name: versionTag,
          name: versionTag,
          body: releaseInfo,
        })
        core.endGroup()
      }

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
