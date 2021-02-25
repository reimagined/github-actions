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
  deploymentId: string
  appUrl: string
  appRuntime: string
  appName: string
}

export type CLI = (args: string, stdio?: StdioOptions) => string
