import * as core from '@actions/core'
import * as github from '@actions/github'
import findVersions from 'find-versions'
import partial from 'lodash.partial'
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

const addComment = async (
  octokit: Octokit,
  event: PullRequestEvent,
  comment: string
): Promise<void> => {
  await octokit.issues.createComment({
    body: comment,
    issue_number: event.number,
    owner: event.repository.owner.login,
    repo: event.repository.name,
  })
}

const determineReleaseVersion = async (
  title: string,
  comment: (message: string) => Promise<void>
): Promise<string> => {
  const versions = findVersions(title)
  if (versions.length === 0) {
    await comment(
      `Unable to determine release version from the PR title. Version should be semver compliant. Valid titles are *Release v1.2.3*, *Hotfix v3.2.1*.`
    )
  }
  if (versions.length > 1) {
    await comment(
      `Multiple release versions found within the PR title (${versions.join(
        ','
      )}).`
    )
  }

  const releaseVersion = versions[0]

  await comment(`Ready to start release version ${releaseVersion}.`)

  return releaseVersion
}

export const onOpened = async (
  octokit: Octokit,
  event: OpenedEvent
): Promise<void> => {
  await determineReleaseVersion(
    event.title,
    partial(addComment, octokit, event)
  )
}

export const onEdited = async (
  octokit: Octokit,
  event: EditedEvent
): Promise<void> => {
  await determineReleaseVersion(
    event.title,
    partial(addComment, octokit, event)
  )
}

export const onReopened = async (
  octokit: Octokit,
  event: ReopenedEvent
): Promise<void> => {
  await determineReleaseVersion(
    event.title,
    partial(addComment, octokit, event)
  )
}

export const main = async (): Promise<void> => {
  const event: PullRequestEvent = JSON.parse(core.getInput('event'))
  const octokit = github.getOctokit(core.getInput('token'))

  switch (event.action) {
    case action_edited:
      return await onEdited(octokit, event)
    case action_opened:
      return await onOpened(octokit, event)
    case action_reopened:
      return await onReopened(octokit, event)
  }
}
