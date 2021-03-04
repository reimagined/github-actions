export type PushEvent = {
  head_commit: {
    id: string
    message: string
  }
  repository: {
    ssh_url: string
  }
}
