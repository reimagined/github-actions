import clone from 'lodash.clonedeep'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import * as path from 'path'

type Dependencies = {
  [key: string]: string
}
type PackageDependencies = {
  dependencies?: Dependencies
  devDependencies?: Dependencies
  peerDependencies?: Dependencies
  optionalDependencies?: Dependencies
}

export const bumpDependencies = (
  pkg: PackageDependencies,
  pattern: string,
  version: string
): any => {
  const regExp = new RegExp('^' + pattern)

  const sections: Array<keyof PackageDependencies> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]
  const target = clone(pkg)

  sections.forEach((name) => {
    const section = target[name]
    if (section == null) {
    } else {
      Object.keys(section).forEach((lib) => {
        if (regExp.test(lib)) {
          section[lib] = version
        }
      })
    }
  })

  return target
}

type Workspace = {
  name: string
  location: string
  pkg: object
}
export type WorkspaceProcessor = (w: Workspace) => Promise<void>

export const processWorkspaces = async (
  processor: WorkspaceProcessor,
  debug: Function
): Promise<void> => {
  const output = execSync(`yarn --silent workspaces info`).toString('utf-8')
  debug(output)
  const info = JSON.parse(output)
  const workspaces = Object.keys(info).map((name) => {
    const location = path.resolve(info[name].location)
    debug(`[${name}] enqueue processing at ${location}`)
    return {
      name,
      location,
      pkg: JSON.parse(
        readFileSync(path.resolve(location, './package.json')).toString('utf-8')
      ),
    }
  })

  await Promise.all(workspaces.map((w) => processor(w)))
}
