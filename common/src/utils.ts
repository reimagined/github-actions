import clone from 'lodash.clonedeep'
import isEmpty from 'lodash.isempty'
import { execSync } from 'child_process'
import {
  readFileSync,
  existsSync,
  writeFileSync,
  copyFileSync,
  unlinkSync,
} from 'fs'
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

  let backupFile: string | null = null
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

  const content =
    token == null
      ? registryBinding
      : `//${registry.host}/:_authToken=${token}\n` +
        `//${registry.host}/:always-auth=true\n` +
        registryBinding

  core?.debug(`writing ${file}`)
  core?.debug(content)

  writeFileSync(file, content)

  return backupFile
}

export const restoreNpmRc = (
  file: string,
  backup?: string | null,
  core?: {
    debug: (message: string) => void
    error: (error: Error) => void
  }
) => {
  try {
    core?.debug(`removing current: ${file}`)
    unlinkSync(file)
  } catch (error) {
    core?.error(error)
  }

  try {
    if (backup != null && !isEmpty(backup)) {
      core?.debug(`restoring from backup: ${backup}`)
      copyFileSync(backup, file)
      unlinkSync(backup)
    }
  } catch (error) {
    core?.error(error)
  }
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

export const parseBoolean = (value: string) =>
  value != null && ['yes', 'true', '1'].includes(value.toLowerCase())

// FIXME: unit test
export function notEmpty<T>(value: T | undefined | null): value is T {
  return !isEmpty(value)
}

// FIXME: unit test
export const exportEnvVar = (
  name: string,
  value: string
): string =>
  execSync(`echo "${name}=${value}" >> $GITHUB_ENV`, {
    stdio: 'pipe',
  }).toString()
