import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import * as path from 'path'
import { parseBoolean } from '../../common/src/utils'
import { getGit } from '../../common/src/git'
import { Octokit, PushEvent } from './types'

const mergeCommitMessage = `<auto> merge version branch`

const getRepo = (event: PushEvent) => ({
  repo: event.repository.name,
  owner: event.repository.owner.name,
})

const createAndApproveVersionPR = async (
  octokit: Octokit,
  event: PushEvent,
  base: string,
  head: string,
  version: string
): Promise<void> => {
  core.debug(`creating version ${version} PR to merge ${head} to ${base}`)

  const {
    data: { number },
  } = await octokit.pulls.create({
    ...getRepo(event),
    base,
    head,
    title: `Back merge release ${version}`,
  })

  core.debug(`adding bot review`)
  await octokit.pulls.createReview({
    ...getRepo(event),
    event: 'APPROVE',
    pull_number: number,
  })

  core.debug(`merging`)
  await octokit.pulls.merge({
    ...getRepo(event),
    pull_number: number,
  })
}

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
      const octokit = getOctokit(core.getInput('token', { required: true }))
      const event: PushEvent = JSON.parse(
        core.getInput(`push_event`, { required: true })
      )

      core.startGroup(`commit release`)
      /*
      core.debug(`checking out ${releaseBranch}`)
      git(`checkout ${releaseBranch}`)

      core.debug(`merging ${versionBranch} to ${releaseBranch}`)
      git(`merge -m "${mergeCommitMessage}" ${versionBranch}`)

      core.debug(`pushing ${releaseBranch} to remote`)
      git(`push`)
      */
      await createAndApproveVersionPR(
        octokit,
        event,
        releaseBranch,
        versionBranch,
        versionTag
      )

      /*
      core.debug(`checking out ${devBranch}`)
      git(`checkout ${devBranch}`)

      core.debug(`pulling ${devBranch} from remote`)
      git(`pull`)

      core.debug(`merging ${releaseBranch} to ${devBranch}`)
      git(`merge -m "${mergeCommitMessage}" ${releaseBranch}`)

      core.debug(`pushing ${devBranch} to remote`)
      git(`push`)
      */
      await createAndApproveVersionPR(
        octokit,
        event,
        devBranch,
        versionBranch,
        versionTag
      )

      core.debug(`tagging with annotated tag ${versionTag}`)
      git(`tag --annotate ${versionTag} --message ${versionTag}`)

      core.debug(`pushing tag to remote`)
      git(`push --tags`)
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
