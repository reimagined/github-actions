import * as github from '@actions/github'

export type Octokit = ReturnType<typeof github.getOctokit>

//const action_assigned = 'assigned'
//const action_unassigned = 'unassigned'
//const action_labeled = 'labeled'
//const action_unlabeled = 'unlabeled'
export const action_opened = 'opened'
export const action_edited = 'edited'
//const action_closed = 'closed'
export const action_reopened = 'reopened'
export const action_synchronize = 'synchronize'
//const action_ready_for_review = 'ready_for_review'
//const action_locked = 'locked'
//const action_unlocked = 'unlocked'
//const action_review_requested = 'review_requested'
//const action_review_request_removed = 'review_request_removed'
export const review_action_submitted = 'submitted'
export const review_action_dismissed = 'dismissed'
export const review_action_edited = 'edited'

type PullRequestState = 'open' | 'closed'

type EventData = {
  pull_request: {
    title: string
    state: PullRequestState
    number: number
  }
  repository: {
    name: string
    owner: {
      login: string
      type: string
    }
  }
}
export type ReviewEventData = {
  review: {
    id: number
    state: string
    user: {
      login: string
    }
  }
}
export type EditedEvent = {
  action: typeof action_edited
} & EventData
export type SynchronizeEvent = {
  action: typeof action_synchronize
} & EventData
export type OpenedEvent = {
  action: typeof action_opened
} & EventData
export type ReopenedEvent = {
  action: typeof action_reopened
} & EventData
export type ReviewEventSubmitted = {
  action: typeof review_action_submitted
} & EventData &
  ReviewEventData
export type ReviewEventDismissed = {
  action: typeof review_action_dismissed
} & EventData &
  ReviewEventData
export type ReviewEventEdited = {
  action: typeof review_action_edited
} & EventData &
  ReviewEventData

export type PullRequestEvent =
  | EditedEvent
  | SynchronizeEvent
  | OpenedEvent
  | ReopenedEvent
  | ReviewEventSubmitted
  | ReviewEventDismissed
  | ReviewEventEdited

export type Bot = {
  name: string
  email: string
}
