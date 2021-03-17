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
  review_action_dismissed,
  review_action_edited,
  review_action_submitted,
  ReviewEventData,
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
  core.debug(`addComment > issue_number: ${event.pull_request.number}`)
  core.debug(`addComment > owner: ${event.repository.owner.login}`)
  core.debug(`addComment > repo: ${event.repository.name}`)

  await octokit.issues.createComment({
    body: comment,
    issue_number: event.pull_request.number,
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
    per_page: Number.MAX_SAFE_INTEGER,
  })

  const releases = data
    .map((entry) => semver.coerce(entry.name))
    .filter(notEmpty)
    .sort(semver.compare)

  const latestRelease = releases.length ? releases[releases.length - 1] : null

  core.debug(`latest release determined by tags: ${latestRelease}`)

  if (latestRelease != null && semver.gte(latestRelease, version)) {
    throw new CheckFailedError(
      `Desired release version **${version.version}** is less or equal latest release tag version **${latestRelease.version}**.`
    )
  }
}

const isAllChecksSuccessful = async (
  octokit: Octokit,
  event: PullRequestEvent
) => {
  const { data: checkRuns } = await octokit.checks.listForRef({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    ref: event.pull_request.head.sha,
  })
  if (checkRuns && checkRuns['total_count'] > 0) {
    const incompleteChecks = checkRuns['check_runs'].filter(
      (check) => check.status !== 'completed'
    )
    if (incompleteChecks.length > 0) {
      await addComment(
        octokit,
        event,
        `Waiting for ${incompleteChecks.length} of ${checkRuns['total-count']} checks to pass`
      )
      return false
    }

    const isUnsuccessful = checkRuns['check_runs'].some(
      (check) =>
        check.conclusion !== 'success' && check.conclusion !== 'neutral'
    )
    if (isUnsuccessful) {
      throw new CheckFailedError(`Some check runs were unsuccessful`)
    }
  }
  return true
}

const getBotApproval = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot
): Promise<number | null> => {
  const { data } = await octokit.pulls.listReviews({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    pull_number: event.pull_request.number,
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
      pull_number: event.pull_request.number,
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
      pull_number: event.pull_request.number,
      event: 'APPROVE',
    })
  }
}

const checkApprovals = async (
  octokit: Octokit,
  event: PullRequestEvent,
  bot: Bot
): Promise<boolean> => {
  const botReviewId = await getBotApproval(octokit, event, bot)

  const requiredApprovalsCount = Number(core.getInput('required_reviews')) || 0
  if (requiredApprovalsCount > 0) {
    const { data } = await octokit.pulls.listReviews({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.pull_request.number,
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
      await addComment(
        octokit,
        event,
        `Need **${
          requiredApprovalsCount - approvedReviews.length
        }** approved review to proceed`
      )
      return false
    }
  } else {
    core.warning(
      `Required approved reviews count is zero. Only the bot approves the pull request.`
    )
  }
  await addComment(
    octokit,
    event,
    `Reviews quorum reached! Approving and merging the PR.`
  )
  return true
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
    pull_number: event.pull_request.number,
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
  if (
    (await isAllChecksSuccessful(octokit, event)) &&
    (await checkApprovals(octokit, event, bot))
  ) {
    await approve(octokit, event, bot)
    await mergePullRequest(octokit, event, version)
  }
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

      case review_action_dismissed:
      case review_action_submitted:
      case review_action_edited:
        const { review } = event as ReviewEventData
        if (review.user.login === bot.name) {
          core.debug(`skip bot review manipulations`)
          return
        }
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
