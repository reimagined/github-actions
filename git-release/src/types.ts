import { getOctokit } from '@actions/github'

export type Octokit = ReturnType<typeof getOctokit>

export type PushEvent = {
  head_commit: {
    id: string
    message: string
  }
  repository: {
    ssh_url: string
    name: string
    owner: {
      name: string
    }
  }
}
