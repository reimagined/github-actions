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
