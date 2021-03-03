import * as core from '@actions/core'
import * as github from '@actions/github'
import findVersions from 'find-versions'
import semver, { SemVer } from 'semver/preload'
import * as os from 'os'
import { execSync } from 'child_process'
import {
  action_edited,
  action_opened,
  action_reopened,
  EditedEvent,
  Octokit,
  OpenedEvent,
  PullRequestEvent,
  ReopenedEvent,
} from './types'

class CheckFailedError extends Error {}

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

const checkVersionConflicts = async (version: SemVer) => {
  core.debug(`pulling all tags from remote`)
  execSync(`git pull --tags`, {
    stdio: 'pipe',
  })

  core.debug(`enumerating all tags`)
  const releases = execSync(`git tag --list`, {
    stdio: 'pipe',
  })
    .toString()
    .split(os.EOL)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length)
    .map((tag) => semver.coerce(tag))
    .filter(notEmpty)
    .sort(semver.compare)

  const latestRelease = releases.length ? releases[releases.length - 1] : null

  if (latestRelease != null && semver.gte(latestRelease, version)) {
    throw new CheckFailedError(
      `Desired release version **${version.version}** is less or equal latest release tag version **${latestRelease.version}**.`
    )
  }
}

const checks = async (
  octokit: Octokit,
  event: PullRequestEvent
): Promise<void> => {
  const version = await determineReleaseVersion(event.pull_request.title)
  await checkVersionConflicts(version)
}

export const onOpened = async (
  octokit: Octokit,
  event: OpenedEvent
): Promise<void> => checks(octokit, event)

export const onEdited = async (
  octokit: Octokit,
  event: EditedEvent
): Promise<void> => checks(octokit, event)

export const onReopened = async (
  octokit: Octokit,
  event: ReopenedEvent
): Promise<void> => checks(octokit, event)

export const main = async (): Promise<void> => {
  const event: PullRequestEvent = JSON.parse(core.getInput('event'))
  const octokit = github.getOctokit(core.getInput('token'))

  try {
    switch (event.action) {
      case action_edited:
        return await onEdited(octokit, event)
      case action_opened:
        return await onOpened(octokit, event)
      case action_reopened:
        return await onReopened(octokit, event)
    }
  } catch (error) {
    if (error instanceof CheckFailedError) {
      await addComment(octokit, event, error.message)
      throw Error('One or more release checks failed')
    }
    throw error
  }
}
