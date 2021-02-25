import { URL } from 'url'
import * as os from 'os'
import { ChildProcess, exec } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import * as core from '@actions/core'
import { mocked } from 'ts-jest/utils'
import { publish } from '../src/publish'
import {
  processWorkspaces,
  WorkspaceProcessor,
  writeNpmRc,
} from '../../common/src/utils'
import { main } from '../src/main'

jest.mock('../src/publish')
jest.mock('../../common/src/utils')
jest.mock('@actions/core')
jest.mock('child_process')
jest.mock('fs')
jest.mock('os')

const mExec = mocked(exec)
const mPublish = mocked(publish)
const mCoreGetInput = mocked(core.getInput)
const mCoreSetOutput = mocked(core.setOutput)
const mCoreSaveState = mocked(core.saveState)
const mCoreDebug = mocked(core.debug)
const mReadFile = mocked(readFileSync)
const mExists = mocked(existsSync)
const mProcessWorkspaces = mocked(processWorkspaces)
const mOSHomeDir = mocked(os.homedir)
const mWriteNpmRc = mocked(writeNpmRc)

const getWorkspaceProcessor = async (): Promise<WorkspaceProcessor> => {
  process.argv = ['node', 'index.js']

  await main()

  expect(mProcessWorkspaces).toHaveBeenCalled()
  return mProcessWorkspaces.mock.calls[0][0]
}

let originalArgv = process.argv
let actionInput: { [key: string]: string }

beforeEach(() => {
  actionInput = {
    registry: 'github',
    token: 'github-token',
    version: '1.2.3',
    tag: 'publish-tag',
  }

  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mExec.mockImplementation((command, options, callback) => {
    callback?.(null, 'executed', '')
    return {} as ChildProcess
  })
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify({
        name: '@package-owner/package-name',
        version: '6.5.4',
      })
    )
  )
  mExists.mockReturnValue(true)
  mOSHomeDir.mockReturnValue('/user-home')
})

afterEach(() => {
  process.argv = originalArgv
})

test('publish command does not invoked if no workspace provided', async () => {
  process.argv = ['node', 'index.js']

  await main()

  expect(mPublish).not.toHaveBeenCalled()
})

test('npmrc and output for "github" registry (owner - auto)', async () => {
  actionInput.registry = 'github'
  actionInput.token = 'github-token'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/user-home/.npmrc',
    new URL('https://npm.pkg.github.com/package-owner'),
    'github-token',
    {
      createBackup: true,
      core,
    }
  )
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://npm.pkg.github.com/package-owner'
  )
  expect(mCoreSaveState).toHaveBeenCalledWith('isGithubRegistry', true)
})

test('npmrc and output for "github" registry (owner - specified)', async () => {
  actionInput.registry = 'github'
  actionInput.token = 'github-token'
  actionInput.owner = 'custom-owner'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/user-home/.npmrc',
    new URL('https://npm.pkg.github.com/custom-owner'),
    'github-token',
    {
      createBackup: true,
      core,
    }
  )
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://npm.pkg.github.com/custom-owner'
  )
  expect(mCoreSaveState).toHaveBeenCalledWith('isGithubRegistry', true)
})

test('npmrc and output for "github" registry (owner - failure)', async () => {
  actionInput.registry = 'github'
  actionInput.token = 'github-token'

  mReadFile.mockReturnValueOnce(
    Buffer.from(
      JSON.stringify({
        name: 'package-name',
        version: '6.5.4',
      })
    )
  )

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('npmrc and output for "npm" registry', async () => {
  actionInput.registry = 'npm'
  actionInput.token = 'npm-token'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/user-home/.npmrc',
    new URL('https://registry.npmjs.org/'),
    'npm-token',
    {
      createBackup: true,
      core,
    }
  )
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://registry.npmjs.org/'
  )
  expect(mCoreSaveState).toHaveBeenCalledWith('isGithubRegistry', false)
})

test('npmrc and output for "npmjs" registry', async () => {
  actionInput.registry = 'npmjs'
  actionInput.token = 'npmjs-token'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/user-home/.npmrc',
    new URL('https://registry.npmjs.org/'),
    'npmjs-token',
    {
      createBackup: true,
      core,
    }
  )
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://registry.npmjs.org/'
  )
  expect(mCoreSaveState).toHaveBeenCalledWith('isGithubRegistry', false)
})

test('npmrc and output for custom registry', async () => {
  actionInput.registry = 'http://resolve-dev.ml:10080'
  actionInput.token = 'resolve-token'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/user-home/.npmrc',
    new URL('http://resolve-dev.ml:10080/'),
    'resolve-token',
    {
      createBackup: true,
      core,
    }
  )
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'http://resolve-dev.ml:10080/'
  )
  expect(mCoreSaveState).toHaveBeenCalledWith('isGithubRegistry', false)
})

test('npmrc backup registered within state', async () => {
  mWriteNpmRc.mockReturnValueOnce('backup-file')

  await main()

  expect(mCoreSaveState).toHaveBeenCalledWith('npmrc_backup', `backup-file`)
})

test('invalid input: bad registry URL', async () => {
  actionInput.registry = 'bad-registry'

  await expect(main()).rejects.toBeInstanceOf(Error)

  expect(mPublish).not.toHaveBeenCalled()
})

test('action state saved for post-job hook', async () => {
  await main()

  expect(mCoreSaveState).toHaveBeenCalledWith('npmrc_file', `/user-home/.npmrc`)
  expect(mCoreSaveState).toHaveBeenCalledWith('version', '1.2.3')
  expect(mCoreSaveState).toHaveBeenCalledWith('tag', 'publish-tag')
  expect(mCoreSaveState).toHaveBeenCalledWith('isGithubRegistry', true)
})

test('action output (except registry)', async () => {
  await main()

  expect(mCoreSetOutput).toHaveBeenCalledWith('version', '1.2.3')
  expect(mCoreSetOutput).toHaveBeenCalledWith('tag', 'publish-tag')
})

test('workspace processor', async () => {
  const processor = await getWorkspaceProcessor()

  await processor({
    name: '@package-owner/mock-package',
    location: '/path/to/package',
    pkg: {
      name: '@package-owner/mock-package',
      version: '1.0.0',
    },
  })
  expect(mExec).not.toHaveBeenCalled()
  expect(mPublish).toHaveBeenCalledWith(
    '1.2.3',
    'publish-tag',
    '/path/to/package'
  )
})

test('workspace processor: (no tag)', async () => {
  actionInput.tag = ''

  const processor = await getWorkspaceProcessor()

  await processor({
    name: '@package-owner/mock-package',
    location: '/path/to/package',
    pkg: {
      name: '@package-owner/mock-package',
      version: '1.0.0',
    },
  })

  expect(mExec).not.toHaveBeenCalled()
  expect(mPublish).toHaveBeenCalledWith('1.2.3', '', '/path/to/package')
})

test('workspace processor: failure', async () => {
  const processor = await getWorkspaceProcessor()

  mPublish.mockImplementationOnce(() => {
    throw Error('failure')
  })

  await expect(
    processor({
      name: '@package-owner/mock-package',
      location: '/path/to/package',
      pkg: {
        name: '@package-owner/mock-package',
        version: '1.0.0',
      },
    })
  ).rejects.toBeInstanceOf(Error)
})

test('workspace processor: skip debug output of stdout if its empty', async () => {
  const processor = await getWorkspaceProcessor()

  mExec.mockImplementationOnce((command, options, callback) => {
    callback?.(null, '', '')
    return {} as ChildProcess
  })

  mCoreDebug.mockClear()

  await processor({
    name: '@package-owner/mock-package',
    location: '/path/to/package',
    pkg: {
      name: '@package-owner/mock-package',
      version: '1.0.0',
    },
  })

  expect(mCoreDebug).not.toHaveBeenCalledWith('')
})

test('workspace processor: skip private packages', async () => {
  const processor = await getWorkspaceProcessor()

  await processor({
    name: '@package-owner/mock-package',
    location: '/path/to/package',
    pkg: {
      name: '@package-owner/mock-package',
      version: '1.0.0',
      private: true,
    },
  })

  expect(mPublish).not.toBeCalled()
})

test('workspace processor: skip unrelated github packages', async () => {
  const processor = await getWorkspaceProcessor()

  await processor({
    name: '@other-owner/mock-package',
    location: '/path/to/package',
    pkg: {
      name: '@other-owner/mock-package',
      version: '1.0.0',
    },
  })

  expect(mPublish).not.toBeCalled()
})

test('workspace processor: skip unscoped github packages', async () => {
  const processor = await getWorkspaceProcessor()

  await processor({
    name: 'mock-package',
    location: '/path/to/package',
    pkg: {
      name: 'mock-package',
      version: '1.0.0',
    },
  })

  expect(mPublish).not.toBeCalled()
})

test('workspace processor: error on bad custom github registry URL', async () => {
  actionInput.registry = 'https://npm.pkg.github.com/'

  const processor = await getWorkspaceProcessor()

  await expect(
    processor({
      name: '@package-owner/mock-package',
      location: '/path/to/package',
      pkg: {
        name: '@package-owner/mock-package',
        version: '1.0.0',
      },
    })
  ).rejects.toBeInstanceOf(Error)
})

test('workspace processor: bypass github checks for other registries', async () => {
  actionInput.registry = 'npm'

  const processor = await getWorkspaceProcessor()

  await processor({
    name: 'mock-package',
    location: '/path/to/package',
    pkg: {
      name: 'mock-package',
      version: '1.0.0',
    },
  })

  expect(mPublish).toBeCalledWith('1.2.3', 'publish-tag', '/path/to/package')
})

test('determine version: valid semver specified', async () => {
  await main()

  expect(mCoreSaveState).toHaveBeenCalledWith('version', '1.2.3')
})

test('determine version: auto without build', async () => {
  const mockDate = new Date('2000-01-01T01:01:01.001Z') as any
  const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

  actionInput.version = 'auto'

  await main()

  expect(mCoreSaveState).toHaveBeenCalledWith(
    'version',
    `6.5.4-2000-01-01T01-01-01-001Z`
  )

  spy.mockRestore()
})

test('determine version: auto with build', async () => {
  actionInput.version = 'auto'
  actionInput.build = 'build'

  await main()

  expect(mCoreSaveState).toHaveBeenCalledWith('version', `6.5.4-build`)
})

test('determine version: invalid semver', async () => {
  actionInput.version = '2'

  await expect(main()).rejects.toBeInstanceOf(Error)
})
