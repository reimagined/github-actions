import { StdioOptions } from 'child_process'

export type Dependencies = {
  [key: string]: string
}
export type PackageDependencies = {
  dependencies?: Dependencies
  devDependencies?: Dependencies
  peerDependencies?: Dependencies
  optionalDependencies?: Dependencies
}
export type Package = {
  name: string
  version: string
  private?: boolean
} & PackageDependencies

export type CloudDeployment = {
  id: string
  url: string
  runtime: string
  name: string
  eventStoreId: string
}

export type CLI = (args: string, stdio?: StdioOptions) => string
export type Git = (args: string, stdio?: StdioOptions) => string

export type DockerRunOptions = {
  mounts?: Array<{
    host: string
    container: string
  }>
  stdio?: StdioOptions
  args?: string
  debug?: (chunk: string) => void
  error?: (chunk: string) => void
}

export type Docker = {
  run: (options?: DockerRunOptions) => Promise<string>
}

export type PushEvent = {
  ref: string
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
