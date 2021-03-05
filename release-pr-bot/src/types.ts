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

type PullRequestState = 'open' | 'closed'

type EventData = {
  number: number
  pull_request: {
    title: string
    state: PullRequestState
  },
  repository: {
    name: string
    owner: {
      login: string
      type: string
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
export type PullRequestEvent =
  | EditedEvent
  | SynchronizeEvent
  | OpenedEvent
  | ReopenedEvent
