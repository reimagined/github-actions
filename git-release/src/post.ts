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

/*
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
*/

const disableBranchProtection = async (
  octokit: Octokit,
  event: PushEvent,
  branch: string
): Promise<any> => {
  const { data: protection } = await octokit.repos.getBranchProtection({
    ...getRepo(event),
    branch,
  })
  core.debug(`current protection rules:`)
  core.debug(JSON.stringify(protection, null, 2))
  return protection
}

const restoreBranchProtection = async (
  octokit: Octokit,
  event: PushEvent,
  branch: string,
  protection: any
): Promise<void> => {
  await octokit.repos.updateBranchProtection({
    ...getRepo(event),
    branch,
    ...protection,
  })
}

export const post = async (): Promise<void> => {
  const success = parseBoolean(core.getState('success'))
  const git = getGit(path.resolve('./'), undefined, core)
  const octokit = getOctokit(core.getInput('token', { required: true }))
  const event: PushEvent = JSON.parse(
    core.getInput(`push_event`, { required: true })
  )

  const versionBranch = core.getState('version_branch')
  const releaseBranch = core.getInput('release_branch')
  let releaseBranchProtection = null

  try {
    if (success) {
      core.info(`successful release, performing tagging and back-merging`)
      const devBranch = core.getInput('development_branch')
      const versionTag = core.getState('version_tag')

      core.debug(`disabling branch ${releaseBranch} protection`)
      releaseBranchProtection = await disableBranchProtection(
        octokit,
        event,
        releaseBranch
      )

      core.startGroup(`commit release`)
      core.debug(`checking out ${releaseBranch}`)
      git(`checkout ${releaseBranch}`)

      core.debug(`merging ${versionBranch} to ${releaseBranch}`)
      git(`merge -m "${mergeCommitMessage}" ${versionBranch}`)

      core.debug(`pushing ${releaseBranch} to remote`)
      git(`push`)

      core.debug(`checking out ${devBranch}`)
      git(`checkout ${devBranch}`)

      core.debug(`pulling ${devBranch} from remote`)
      git(`pull`)

      core.debug(`merging ${releaseBranch} to ${devBranch}`)
      git(`merge -m "${mergeCommitMessage}" ${releaseBranch}`)

      core.debug(`pushing ${devBranch} to remote`)
      git(`push`)

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
    if (releaseBranchProtection != null) {
      core.debug(`restoring branch ${releaseBranch} protection`)
      await restoreBranchProtection(
        octokit,
        event,
        releaseBranch,
        releaseBranchProtection
      )
    }
    core.debug(`anyway deleting remote ${versionBranch}`)
    git(`push origin --delete refs/heads/${versionBranch}`)
  }
}
