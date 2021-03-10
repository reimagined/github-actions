import { URL } from 'url'
import { mocked } from 'ts-jest/utils'
import { writeFileSync, readFileSync } from 'fs'
import * as core from '@actions/core'
import {
  WorkspaceProcessor,
  processWorkspaces,
  bumpDependencies,
  writeNpmRc,
  parseScopes,
} from '../../common/src/utils'
import { main } from '../src/main'
import * as utils from '../../common/src/utils'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('../../common/src/utils')

const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mCoreGetInput = mocked(core.getInput)
const mCoreSetOutput = mocked(core.setOutput)
const mProcessWorkspaces = mocked(processWorkspaces)
const mBumpDependencies = mocked(bumpDependencies)
const mWriteNpmRc = mocked(writeNpmRc)
const mParseScopes = mocked(parseScopes)
const mCreateExecutor = mocked(utils.createExecutor)

let actionInput: { [key: string]: string }

const originalEnv = process.env

const getWorkspaceProcessor = async (): Promise<
  WorkspaceProcessor<unknown>
> => {
  await main()

  expect(mProcessWorkspaces).toHaveBeenCalled()
  return mProcessWorkspaces.mock.calls[0][0]
}

let execSync = jest.fn()

beforeEach(() => {
  actionInput = {
    aws_access_key_id: 'aws-access-key-id',
    aws_secret_access_key: 'aws-secret-access-key',
    source: '/source',
    stage: 'cloud-stage',
  }
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  execSync.mockImplementation((command) => {
    let result = ''
    if (command.includes('admin-cli get-api-url')) {
      result = 'http://cloud-api-url.com'
    }
    return Buffer.from(result)
  })
  mCreateExecutor.mockImplementation((command) => execSync)
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify({
        name: '@package-owner/package-name',
        version: '6.5.4',
      })
    )
  )
  mBumpDependencies.mockReturnValue({})
  mParseScopes.mockReturnValue([])
  process.env = {
    THIS_PROCESS_ENV: 'yes',
  }
})

afterEach(() => {
  process.env = originalEnv
})

test('source dependencies are installed', async () => {
  await main()

  expect(execSync).toHaveBeenCalledWith('yarn install')
})

test('cloud assets are built', async () => {
  await main()

  expect(execSync).toHaveBeenCalledWith('yarn build-assets')
})

test('stage resources rollout', async () => {
  await main()

  expect(execSync).toHaveBeenCalledWith(
    'yarn -s admin-cli stage-resources install --stage=cloud-stage'
  )
})

test('version resources rollout (no version input)', async () => {
  await main()

  expect(execSync).toHaveBeenCalledWith(
    'yarn -s admin-cli version-resources install --stage=cloud-stage --version=6.5.4'
  )
})

test('version resources rollout (specified version)', async () => {
  actionInput.version = '1.2.3'

  await main()

  expect(execSync).toHaveBeenCalledWith(
    'yarn -s admin-cli version-resources install --stage=cloud-stage --version=1.2.3'
  )
})

test('cloud API url retrieved and assigned to output', async () => {
  await main()

  expect(execSync).toHaveBeenCalledWith(
    'yarn -s admin-cli get-api-url --stage=cloud-stage',
    'pipe'
  )

  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'api_url',
    'http://cloud-api-url.com'
  )
})

test('workspace processor should patch package.json', async () => {
  actionInput.version = '1.2.3'
  actionInput.framework_scope = '@scope'

  const processor = await getWorkspaceProcessor()

  jest.clearAllMocks()

  await processor({
    location: '/location',
    name: 'package-name',
    pkg: {
      name: 'package-name',
      version: '3.3.3',
    },
  })

  expect(mWriteFile).toHaveBeenCalledWith(
    '/location/package.json',
    JSON.stringify({}, null, 2)
  )
  expect(mBumpDependencies).toHaveBeenCalledWith(
    {
      name: 'package-name',
      version: '3.3.3',
    },
    '@scope/.*$',
    '1.2.3'
  )
})

test('disable workspace processing if no version provided within input', async () => {
  await main()

  expect(mProcessWorkspaces).not.toHaveBeenCalled()
  expect(mBumpDependencies).not.toHaveBeenCalled()
})

test('custom registry: skip npmrc writing if no registry input provided', async () => {
  await main()

  expect(mWriteNpmRc).not.toHaveBeenCalled()
})

test('custom registry: throw error if registry is invalid URL', async () => {
  actionInput.registry = 'bad-url'

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('custom registry: set registry for whole project', async () => {
  actionInput.registry = 'https://packages.org'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    `/source/.npmrc`,
    new URL('https://packages.org'),
    undefined,
    {
      core,
      scopes: [],
    }
  )
})

test('custom registry: set registry for whole project (with auth token)', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.token = 'registry-token'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    `/source/.npmrc`,
    new URL('https://packages.org'),
    'registry-token',
    {
      core,
      scopes: [],
    }
  )
})

test('custom registry: set registry for specified package scopes', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.scopes = 'raw-scopes'

  mParseScopes.mockReturnValueOnce(['parsed-scopes'])

  await main()

  expect(mParseScopes).toHaveBeenCalledWith('raw-scopes')
  expect(mWriteNpmRc).toHaveBeenCalledWith(
    `/source/.npmrc`,
    new URL('https://packages.org'),
    undefined,
    {
      core,
      scopes: ['parsed-scopes'],
    }
  )
})

test('custom registry: set registry for specified package scopes (with auth token)', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.scopes = 'raw-scopes'
  actionInput.token = 'registry-token'

  mParseScopes.mockReturnValueOnce(['parsed-scopes'])

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    `/source/.npmrc`,
    new URL('https://packages.org'),
    'registry-token',
    {
      core,
      scopes: ['parsed-scopes'],
    }
  )
})

test('throw error if input version not semver compliant', async () => {
  actionInput.version = '007'

  await expect(main()).rejects.toBeInstanceOf(Error)
})
