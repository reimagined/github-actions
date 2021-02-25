import clone from 'lodash.clonedeep'
import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import * as path from 'path'
import * as process from 'process'
import { Package, PackageDependencies } from './types'

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
  pkg: Package
}
export type WorkspaceProcessor = (w: Workspace) => Promise<void>

export const processWorkspaces = async (
  processor: WorkspaceProcessor,
  debug: Function,
  cwd: string = process.cwd()
): Promise<void> => {
  const output = execSync(`yarn --silent workspaces info`, {
    cwd,
  }).toString('utf-8')
  debug(output)
  const info = JSON.parse(output)
  const workspaces = Object.keys(info).map((name) => {
    const location = path.resolve(cwd, info[name].location)
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

type WriteNpmRcOptions = {
  createBackup?: boolean
  scopes?: string[]
  core?: {
    info: (message: string) => void
    debug: (message: string) => void
  }
}

export const writeNpmRc = (
  file: string,
  registry: URL,
  token?: string,
  options: WriteNpmRcOptions = {
    createBackup: false,
  }
): string | null => {
  const { core, createBackup, scopes } = options

  let backupFile = null
  if (createBackup && existsSync(file)) {
    backupFile = path.resolve(path.dirname(file), '._build_npmrc_orig_')
    core?.info(`npmrc file exists, backing up to: ${backupFile}`)
    copyFileSync(file, backupFile)
  }

  const registryBinding =
    scopes != null && scopes.length > 0
      ? scopes
          .map(
            (scope) =>
              `${scope}:registry=${registry.protocol}//${registry.host}\n`
          )
          .join('')
      : `registry=${registry.href}\n`

  core?.debug(`writing ${file}`)

  writeFileSync(
    file,
    token == null
      ? registryBinding
      : `//${registry.host}/:_authToken=${token}\n` +
          `//${registry.host}/:always-auth=true\n` +
          registryBinding
  )
  return backupFile
}

export const parseScopes = (
  scopes: string | undefined | null
): Array<string> => {
  if (scopes != null) {
    return scopes
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope.length)
  }
  return []
}

export const isTrue = (value: string) =>
  value != null && ['yes', 'true', '1'].includes(value.toLowerCase())
