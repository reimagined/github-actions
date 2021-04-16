import { mocked } from 'ts-jest/utils'
import { execSync } from 'child_process'
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  unlinkSync,
} from 'fs'
import * as process from 'process'
import {
  bumpDependencies,
  processWorkspaces,
  writeNpmRc,
  restoreNpmRc,
  parseScopes,
  WorkspaceProcessor,
  parseBoolean,
  createExecutor,
} from '../src/utils'

jest.mock('child_process')
jest.mock('fs')

const mExec = mocked(execSync)
const mReadFile = mocked(readFileSync)
const mWriteFile = mocked(writeFileSync)
const mCopyFile = mocked(copyFileSync)
const mExists = mocked(existsSync)
const mUnlink = mocked(unlinkSync)

const getNpmRcContent = (): string =>
  mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/.npmrc'
  )?.[1] as string

describe('bumpDependencies', () => {
  test('bump [dependencies]', () => {
    const result = bumpDependencies(
      {
        dependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      dependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [devDependencies]', () => {
    const result = bumpDependencies(
      {
        devDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      devDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [peerDependencies]', () => {
    const result = bumpDependencies(
      {
        peerDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      peerDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [optionalDependencies]', () => {
    const result = bumpDependencies(
      {
        optionalDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      optionalDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump with entries', () => {
    const result = bumpDependencies(
      {
        dependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      ['@scope/tools'],
      '1.2.3'
    )

    expect(result).toEqual({
      dependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '0.0.0',
        jest: '4.3.2',
      },
    })
  })
})

describe('processWorkspaces', () => {
  let output: string
  let processor: jest.MockedFunction<WorkspaceProcessor<void>>

  beforeEach(() => {
    output = JSON.stringify({
      'package-a': {
        location: 'path/to/a',
      },
      'package-b': {
        location: 'path/to/b',
      },
    })
    mExec.mockReturnValue(Buffer.from(output))
    processor = jest.fn()
    mReadFile.mockImplementation((file) =>
      Buffer.from(
        JSON.stringify({
          name: file,
        })
      )
    )
  })

  test('yarn workspaces info requested in current directory', async () => {
    await processWorkspaces(processor, jest.fn())

    expect(mExec).toHaveBeenCalledWith(expect.any(String), {
      cwd: process.cwd(),
    })
    expect(mExec.mock.calls[0][0]).toMatchInlineSnapshot(
      `"yarn --silent workspaces info"`
    )
  })

  test('yarn workspaces info requested within specified directory', async () => {
    await processWorkspaces(processor, jest.fn(), '/working-directory')

    expect(mExec).toHaveBeenCalledWith(expect.any(String), {
      cwd: '/working-directory',
    })
  })

  test('processor invoked for each workspace in current working directory', async () => {
    await processWorkspaces(processor, jest.fn())

    expect(processor).toHaveBeenCalledWith({
      name: 'package-a',
      location: `${process.cwd()}/path/to/a`,
      pkg: {
        name: `${process.cwd()}/path/to/a/package.json`,
      },
    })
    expect(processor).toHaveBeenCalledWith({
      name: 'package-b',
      location: `${process.cwd()}/path/to/b`,
      pkg: {
        name: `${process.cwd()}/path/to/b/package.json`,
      },
    })
  })

  test('package.json files read in current working directory', async () => {
    await processWorkspaces(processor, jest.fn())

    expect(mReadFile).toHaveBeenCalledWith(
      `${process.cwd()}/path/to/a/package.json`
    )
    expect(mReadFile).toHaveBeenCalledWith(
      `${process.cwd()}/path/to/b/package.json`
    )
  })

  test('processor invoked for each workspace in specified directory', async () => {
    await processWorkspaces(processor, jest.fn(), '/specified')

    expect(processor).toHaveBeenCalledWith({
      name: 'package-a',
      location: `/specified/path/to/a`,
      pkg: {
        name: `/specified/path/to/a/package.json`,
      },
    })
    expect(processor).toHaveBeenCalledWith({
      name: 'package-b',
      location: `/specified/path/to/b`,
      pkg: {
        name: `/specified/path/to/b/package.json`,
      },
    })
  })

  test('package.json files read in specified directory', async () => {
    await processWorkspaces(processor, jest.fn(), '/specified')

    expect(mReadFile).toHaveBeenCalledWith(`/specified/path/to/a/package.json`)
    expect(mReadFile).toHaveBeenCalledWith(`/specified/path/to/b/package.json`)
  })
})

describe('writeNpmRc', () => {
  test('npmrc and output for custom registry', async () => {
    await writeNpmRc(
      `/source/.npmrc`,
      new URL('http://resolve-dev.ml:10080'),
      'registry-token'
    )

    expect(mWriteFile).toHaveBeenCalledWith(
      `/source/.npmrc`,
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "//resolve-dev.ml:10080/:_authToken=registry-token
    //resolve-dev.ml:10080/:always-auth=true
    registry=http://resolve-dev.ml:10080/
    "
  `)
  })

  test('npmrc backup created', async () => {
    mExists.mockReturnValueOnce(true)

    const result = await writeNpmRc(
      `/source/.npmrc`,
      new URL('http://resolve-dev.ml:10080'),
      'registry-token',
      {
        createBackup: true,
      }
    )

    expect(mExists).toHaveBeenCalledWith(`/source/.npmrc`)
    expect(mCopyFile).toHaveBeenCalledWith(
      `/source/.npmrc`,
      `/source/._build_npmrc_orig_`
    )
    expect(result).toEqual(`/source/._build_npmrc_orig_`)
  })

  test('core log used', async () => {
    mExists.mockReturnValueOnce(true)
    const core = {
      debug: jest.fn(),
      info: jest.fn(),
    }

    await writeNpmRc(
      `/user/.npmrc`,
      new URL('http://resolve-dev.ml:10080'),
      'registry-token',
      {
        createBackup: true,
        core,
      }
    )

    expect(core.debug).toHaveBeenCalledWith(expect.any(String))
    expect(core.info).toHaveBeenCalledWith(expect.any(String))
  })

  test('custom registry: set registry for whole project', async () => {
    await writeNpmRc(`/source/.npmrc`, new URL('https://packages.org'))

    expect(mWriteFile).toHaveBeenCalledWith(
      '/source/.npmrc',
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "registry=https://packages.org/
    "
  `)
  })

  test('custom registry: set registry for whole project (with auth token)', async () => {
    await writeNpmRc(
      `/source/.npmrc`,
      new URL('https://packages.org'),
      'registry-token'
    )

    expect(mWriteFile).toHaveBeenCalledWith(
      '/source/.npmrc',
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "//packages.org/:_authToken=registry-token
    //packages.org/:always-auth=true
    registry=https://packages.org/
    "
  `)
  })

  test('custom registry: set registry for specified package scopes', async () => {
    await writeNpmRc(
      `/source/.npmrc`,
      new URL('https://packages.org'),
      undefined,
      {
        scopes: ['@scope-a', '@scope-b'],
      }
    )

    expect(mWriteFile).toHaveBeenCalledWith(
      '/source/.npmrc',
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "@scope-a:registry=https://packages.org
    @scope-b:registry=https://packages.org
    "
  `)
  })

  test('custom registry: set registry for specified package scopes (with auth token)', async () => {
    await writeNpmRc(
      `/source/.npmrc`,
      new URL('https://packages.org'),
      'registry-token',
      {
        scopes: ['@scope-a', '@scope-b'],
      }
    )

    expect(mWriteFile).toHaveBeenCalledWith(
      '/source/.npmrc',
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "//packages.org/:_authToken=registry-token
    //packages.org/:always-auth=true
    @scope-a:registry=https://packages.org
    @scope-b:registry=https://packages.org
    "
  `)
  })

  test('custom registry: github specific - registry URL with path', async () => {
    await writeNpmRc(`/source/.npmrc`, new URL('https://packages.org/scope'))

    expect(mWriteFile).toHaveBeenCalledWith(
      '/source/.npmrc',
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "registry=https://packages.org/scope
    "
  `)
  })

  test('custom registry: github specific - scopes should not contain path in registry URL', async () => {
    await writeNpmRc(
      `/source/.npmrc`,
      new URL('https://packages.org/scope'),
      undefined,
      {
        scopes: ['@scope-a', '@scope-b'],
      }
    )

    expect(mWriteFile).toHaveBeenCalledWith(
      '/source/.npmrc',
      expect.any(String)
    )
    expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "@scope-a:registry=https://packages.org
    @scope-b:registry=https://packages.org
    "
  `)
  })
})

describe('restoreNpmRc', () => {
  test('npmrc file removed and restored from backup', () => {
    restoreNpmRc('/target', '/backup')

    expect(mUnlink).toHaveBeenCalledWith('/target')
    expect(mCopyFile).toHaveBeenCalledWith(`/backup`, `/target`)
    expect(mUnlink).toHaveBeenCalledWith('/backup')
  })

  test('restored from backup even if target not exist or cannot be removed', () => {
    mUnlink.mockImplementationOnce(() => {
      throw Error('i/o error')
    })

    restoreNpmRc('/target', '/backup')

    expect(mUnlink).toHaveBeenCalledWith('/target')
    expect(mCopyFile).toHaveBeenCalledWith(`/backup`, `/target`)
    expect(mUnlink).toHaveBeenCalledWith('/backup')
  })

  test('skip restoring if no backup file provided', () => {
    restoreNpmRc('/target')

    expect(mUnlink).toHaveBeenCalledWith('/target')
    expect(mUnlink).toHaveBeenCalledTimes(1)
    expect(mCopyFile).not.toHaveBeenCalled()
  })

  test('skip restoring if empty backup file provided', () => {
    restoreNpmRc('/target', '')

    expect(mUnlink).toHaveBeenCalledWith('/target')
    expect(mUnlink).toHaveBeenCalledTimes(1)
    expect(mCopyFile).not.toHaveBeenCalled()
  })

  test('tolerate backup error', () => {
    mCopyFile.mockImplementationOnce(() => {
      throw Error('i/o error')
    })

    restoreNpmRc('/target', '/backup')
  })

  test('core logger: npmrc remove failure', () => {
    const core = {
      debug: jest.fn(),
      error: jest.fn(),
    }
    mUnlink.mockImplementationOnce(() => {
      throw Error('i/o error')
    })

    restoreNpmRc('/target', '/backup', core)

    expect(core.debug).toHaveBeenCalled()
    expect(core.error).toHaveBeenCalled()
  })

  test('core logger: backup restore failure', () => {
    const core = {
      debug: jest.fn(),
      error: jest.fn(),
    }
    mCopyFile.mockImplementationOnce(() => {
      throw Error('i/o error')
    })

    restoreNpmRc('/target', '/backup', core)

    expect(core.debug).toHaveBeenCalled()
    expect(core.error).toHaveBeenCalled()
  })
})

describe('parseScopes', () => {
  test('valid input', () => {
    expect(parseScopes('@scope-a')).toEqual(['@scope-a'])
    expect(parseScopes('@scope-a,@scope-b')).toEqual(['@scope-a', '@scope-b'])
    expect(parseScopes('@scope-a, @scope-b')).toEqual(['@scope-a', '@scope-b'])
    expect(parseScopes('@scope-a,,@scope-b')).toEqual(['@scope-a', '@scope-b'])
    expect(parseScopes('@scope-a,@scope-b,')).toEqual(['@scope-a', '@scope-b'])
    expect(parseScopes('@scope-a,@scope-b,@scope-c')).toEqual([
      '@scope-a',
      '@scope-b',
      '@scope-c',
    ])
    expect(parseScopes('')).toEqual([])
    expect(parseScopes(',')).toEqual([])
    expect(parseScopes(',,')).toEqual([])
    expect(parseScopes(',@scope-a')).toEqual(['@scope-a'])
    expect(parseScopes(undefined)).toEqual([])
    expect(parseScopes(null)).toEqual([])
  })
})

describe('parseBoolean', () => {
  test('true', () => {
    expect(parseBoolean('yes')).toBeTruthy()
    expect(parseBoolean('YES')).toBeTruthy()
    expect(parseBoolean('yEs')).toBeTruthy()
    expect(parseBoolean('true')).toBeTruthy()
    expect(parseBoolean('TruE')).toBeTruthy()
    expect(parseBoolean('1')).toBeTruthy()
  })

  test('false', () => {
    expect(parseBoolean('no')).toBeFalsy()
    expect(parseBoolean('No')).toBeFalsy()
    expect(parseBoolean('false')).toBeFalsy()
    expect(parseBoolean('False')).toBeFalsy()
    expect(parseBoolean('0')).toBeFalsy()
    expect(parseBoolean('bla-bla')).toBeFalsy()
  })
})

describe('createExecutor', async () => {
  test('should return command executor and work correctly', () => {
    const cwd = 'source'
    const stdio = 'pipe'
    const script = `echo ${Date.now()}`
    const env = {
      AWS_ACCESS_KEY_ID: 'awsAccessKeyId',
      AWS_SECRET_ACCESS_KEY: 'awsSecretAccessKey',
    }

    const commandExecutor = createExecutor(cwd, env)

    commandExecutor(script, stdio)

    expect(mExec).toHaveBeenCalledWith(script, {
      cwd,
      stdio,
      env: {
        ...process.env,
        ...env,
      },
    })
  })
})
