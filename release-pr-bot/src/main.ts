import * as core from '@actions/core'
import * as github from '@actions/github'
import findVersions from 'find-versions'
import semver, { SemVer } from 'semver/preload'
import {
  action_edited,
  action_opened,
  action_reopened,
  Octokit,
  PullRequestEvent,
} from './types'

class CheckFailedError extends Error {
  constructor(props) {
    super(props)
    Object.setPrototypeOf(this, CheckFailedError.prototype)
  }
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

const addComment = async (
  octokit: Octokit,
  event: PullRequestEvent,
  comment: string
): Promise<void> => {
  core.debug(`addComment > comment: ${comment}`)
  core.debug(`addComment > issue_number: ${event.number}`)
  core.debug(`addComment > owner: ${event.repository.owner.login}`)
  core.debug(`addComment > repo: ${event.repository.name}`)

  await octokit.issues.createComment({
    body: comment,
    issue_number: event.number,
    owner: event.repository.owner.login,
    repo: event.repository.name,
  })
}

const determineReleaseVersion = async (title: string): Promise<SemVer> => {
  core.debug(`determineReleaseVersion > title: ${title}`)
  const versions = findVersions(title)
  if (versions.length === 0) {
    throw new CheckFailedError(
      `Unable to determine release version from the PR title. Version should be semver compliant. Valid titles are *Release v1.2.3*, *Hotfix v3.2.1*.`
    )
  }
  if (versions.length > 1) {
    throw new CheckFailedError(
      `Multiple release versions found within the PR title (*${versions.join(
        ' , '
      )}*).`
    )
  }

  const releaseVersion = semver.parse(versions[0])
  if (releaseVersion == null) {
    throw new CheckFailedError(
      `Release version (${versions[0]}) seems not to be semver compliant`
    )
  }

  core.debug(
    `determineReleaseVersion > releaseVersion: ${releaseVersion.version}`
  )
  return releaseVersion
}

const checkVersionConflicts = async (
  octokit: Octokit,
  event: PullRequestEvent,
  version: SemVer
) => {
  const { data } = await octokit.repos.listTags({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    per_page: 100000,
  })

  const releases = data
    .map((entry) => semver.coerce(entry.name))
    .filter(notEmpty)
    .sort(semver.compare)

  const latestRelease = releases.length ? releases[releases.length - 1] : null

  if (latestRelease != null && semver.gte(latestRelease, version)) {
    throw new CheckFailedError(
      `Desired release version **${version.version}** is less or equal latest release tag version **${latestRelease.version}**.`
    )
  }
}

const dismiss = async (
  octokit: Octokit,
  event: PullRequestEvent,
  message: string
): Promise<void> => {
  const { data } = await octokit.pulls.listReviews({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.number,
    per_page: 100000,
  })

  // FIXME: take bot login or id from action input
  const botReview = data.find((review) => review?.user?.login === 'resolve-bot')

  if (botReview != null) {
    await octokit.pulls.dismissReview({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.number,
      review_id: botReview.id,
      message,
    })
  }
}

const checkApprovals = async (octokit: Octokit, event: PullRequestEvent) => {
  const requiredApprovalsCount = Number(core.getInput('required_reviews')) || 1

  const { data } = await octokit.pulls.listReviews({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.number,
  })
  const approvedReviews = data.filter((entry) => entry.state === 'APPROVED')
  if (!approvedReviews.some((entry) => entry.user?.login === 'resolve-bot')) {
    throw new CheckFailedError(`Waiting for resolve-bot approval`)
  }
  if (approvedReviews.length < requiredApprovalsCount) {
    throw new CheckFailedError(
      `Waiting for ${
        requiredApprovalsCount - approvedReviews.length
      } more pull request approvals`
    )
  }
}

const mergePullRequest = async (
  octokit: Octokit,
  event: PullRequestEvent,
  version: SemVer
) => {
  await octokit.pulls.merge({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.number,
    commit_title: `Release ${version.version}`,
  })
}

const processPullRequestEvent = async (
  octokit: Octokit,
  event: PullRequestEvent
): Promise<void> => {
  const version = await determineReleaseVersion(event.pull_request.title)
  await checkVersionConflicts(octokit, event, version)
  await octokit.pulls.createReview({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.number,
    event: 'APPROVE',
  })
  await checkApprovals(octokit, event)
  await mergePullRequest(octokit, event, version)
}

export const main = async (): Promise<void> => {
  const event: PullRequestEvent = JSON.parse(core.getInput('event'))
  const octokit = github.getOctokit(core.getInput('token'))

  try {
    switch (event.action) {
      case action_edited:
      case action_opened:
      case action_reopened:
        return await processPullRequestEvent(octokit, event)
    }
  } catch (error) {
    core.debug(error)
    if (error instanceof CheckFailedError) {
      await addComment(octokit, event, error.message)
      await dismiss(octokit, event, error.message)
      throw Error('One or more release checks failed')
    }
    throw error
  }
}
