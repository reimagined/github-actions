import * as core from '@actions/core'
import * as github from '@actions/github'
import findVersions from 'find-versions'
import semver, { SemVer } from 'semver/preload'
import {
  action_edited,
  action_opened,
  action_reopened,
  Bot,
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

const getBotApproval = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot
): Promise<number | null> => {
  const { data } = await octokit.pulls.listReviews({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.number,
  })

  core.debug(`dismiss > listReviews:`)
  data.forEach((entry) =>
    core.debug(
      `[${entry.user?.login}@${entry.id}, ${entry.state}]: ${entry.body}`
    )
  )

  const botReview = data.find(
    (review) => review?.user?.login === bot.name && review?.state === 'APPROVED'
  )

  if (botReview != null) {
    return botReview.id
  }
  return null
}

const dismiss = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot,
  message: string
): Promise<void> => {
  const reviewId = await getBotApproval(octokit, event, bot)

  if (reviewId != null) {
    core.debug(`dismissing bot review: ${reviewId}`)
    await octokit.pulls.dismissReview({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.number,
      review_id: reviewId,
      message,
    })
  }
}

const approve = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot
): Promise<void> => {
  const reviewId = await getBotApproval(octokit, event, bot)

  if (reviewId == null) {
    core.debug(`approving pull request`)
    await octokit.pulls.createReview({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.number,
      event: 'APPROVE',
    })
  }
}

const checkApprovals = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot
) => {
  const botReviewId = await getBotApproval(octokit, event, bot)
  if (botReviewId == null) {
    throw new CheckFailedError(
      `Its strange, but i can\'t find my approval of this pull request.`
    )
  }

  const requiredApprovalsCount = Number(core.getInput('required_reviews')) || 0
  if (requiredApprovalsCount > 0) {
    const { data } = await octokit.pulls.listReviews({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.number,
    })

    core.debug(`checkApprovals > listReviews:`)
    data.forEach((entry) =>
      core.debug(
        `[${entry.user?.login}@${entry.id}, ${entry.state}]: ${entry.body}`
      )
    )

    const approvedReviews = data.filter(
      (entry) => entry.state === 'APPROVED' && entry.id !== botReviewId
    )

    if (approvedReviews.length < requiredApprovalsCount) {
      throw new CheckFailedError(
        `Need **${
          requiredApprovalsCount - approvedReviews.length
        }** approved review to proceed`
      )
    }
  } else {
    core.warning(
      `Required approved reviews count is zero. Only the bot approves the pull request.`
    )
  }
}

const mergePullRequest = async (
  octokit: Octokit,
  event: PullRequestEvent,
  version: SemVer
) => {
  core.debug(`mergePullRequest > version: ${version.version}`)

  await octokit.pulls.merge({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.number,
    commit_title: `Release ${version.version}`,
  })
}

const processPullRequestEvent = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot
): Promise<void> => {
  const version = await determineReleaseVersion(event.pull_request.title)
  await checkVersionConflicts(octokit, event, version)
  await approve(octokit, event, bot)
  await checkApprovals(octokit, event, bot)
  await mergePullRequest(octokit, event, version)
}

export const main = async (): Promise<void> => {
  const event: PullRequestEvent = JSON.parse(core.getInput('event'))
  const octokit = github.getOctokit(core.getInput('token'))

  const {
    data: { login: name, email },
  } = await octokit.users.getAuthenticated()

  if (!name || !email) {
    throw Error(`Invalid or limited GitHub user PAT`)
  }

  const bot = { name, email }

  try {
    switch (event.action) {
      case action_edited:
      case action_opened:
      case action_reopened:
        return await processPullRequestEvent(octokit, event, bot)
    }
  } catch (error) {
    core.debug(error)
    if (error instanceof CheckFailedError) {
      await addComment(octokit, event, error.message)
      await dismiss(octokit, event, bot, error.message)
      throw Error('One or more release checks failed')
    }
    throw error
  }
}
