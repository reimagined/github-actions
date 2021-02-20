import { mocked } from 'ts-jest/utils'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'
import { getInput, setOutput } from '@actions/core'
import {
  WorkspaceProcessor,
  processWorkspaces,
  bumpDependencies,
} from '../../common/src/utils'
import { main } from '../src/main'

jest.mock('child_process')
jest.mock('@actions/core')
jest.mock('fs')
jest.mock('../../common/src/utils')

const mExec = mocked(execSync)
const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mCoreGetInput = mocked(getInput)
const mCoreSetOutput = mocked(setOutput)
const mProcessWorkspaces = mocked(processWorkspaces)
const mBumpDependencies = mocked(bumpDependencies)

let actionInput: { [key: string]: string }

const originalEnv = process.env

const expectedEnv = () => ({
  THIS_PROCESS_ENV: 'yes',
  AWS_ACCESS_KEY_ID: actionInput.aws_access_key_id,
  AWS_SECRET_ACCESS_KEY: actionInput.aws_secret_access_key,
})

const getWorkspaceProcessor = async (): Promise<WorkspaceProcessor> => {
  await main()

  expect(mProcessWorkspaces).toHaveBeenCalled()
  return mProcessWorkspaces.mock.calls[0][0]
}

const getNpmRcContent = (): string =>
  mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/.npmrc'
  )?.[1] as string

beforeEach(() => {
  actionInput = {
    aws_access_key_id: 'aws-access-key-id',
    aws_secret_access_key: 'aws-secret-access-key',
    source: '/source',
    stage: 'cloud-stage',
  }
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mExec.mockImplementation((command) => {
    let result = ''
    if (command.includes('admin-cli get-api-url')) {
      result = 'http://cloud-api-url.com'
    }
    return Buffer.from(result)
  })
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify({
        name: '@package-owner/package-name',
        version: '6.5.4',
      })
    )
  )
  mBumpDependencies.mockReturnValue({ name: 'bumped-package' })
  process.env = {
    THIS_PROCESS_ENV: 'yes',
  }
})

afterEach(() => {
  process.env = originalEnv
})

test('source dependencies are installed', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith('yarn install', {
    stdio: 'inherit',
    cwd: '/source',
    env: expectedEnv(),
  })
})

test('cloud assets are built', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith('yarn build-assets', {
    stdio: 'inherit',
    cwd: '/source',
    env: expectedEnv(),
  })
})

test('stage resources rollout', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith(
    'yarn -s admin-cli stage-resources install --stage=cloud-stage',
    {
      stdio: 'inherit',
      cwd: '/source',
      env: expectedEnv(),
    }
  )
})

test('version resources rollout (no version input)', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith(
    'yarn -s admin-cli version-resources install --stage=cloud-stage --version=6.5.4',
    {
      stdio: 'inherit',
      cwd: '/source',
      env: expectedEnv(),
    }
  )
})

test('version resources rollout (specified version)', async () => {
  actionInput.version = '1.2.3'

  await main()

  expect(mExec).toHaveBeenCalledWith(
    'yarn -s admin-cli version-resources install --stage=cloud-stage --version=1.2.3',
    {
      stdio: 'inherit',
      cwd: '/source',
      env: expectedEnv(),
    }
  )
})

test('cloud API url retrieved and assigned to output', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith(
    'yarn -s admin-cli get-api-url --stage=cloud-stage',
    {
      stdio: 'pipe',
      cwd: '/source',
      env: expectedEnv(),
    }
  )

  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'api_url',
    'http://cloud-api-url.com'
  )
})

test('workspace processor should patch package.json', async () => {
  actionInput.version = '1.2.3'

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
    JSON.stringify({ name: 'bumped-package' }, null, 2)
  )
  expect(mBumpDependencies).toHaveBeenCalledWith(
    {
      name: 'package-name',
      version: '3.3.3',
    },
    '@reimagined/.*$',
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

  expect(mWriteFile).not.toHaveBeenCalledWith(
    '/source/.npmrc',
    expect.any(String)
  )
})

test('custom registry: throw error if registry is invalid URL', async () => {
  actionInput.registry = 'bad-url'

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('custom registry: set registry for whole project', async () => {
  actionInput.registry = 'https://packages.org'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith('/source/.npmrc', expect.any(String))
  expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "registry=https://packages.org/
    "
  `)
})

test('custom registry: set registry for whole project (with auth token)', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.token = 'registry-token'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith('/source/.npmrc', expect.any(String))
  expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "//packages.org/:_authToken=registry-token
    //packages.org/:always-auth=true
    registry=https://packages.org/
    "
  `)
})

test('custom registry: set registry for specified package scopes', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.scopes = '@scope-a,@scope-b'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith('/source/.npmrc', expect.any(String))
  expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "@scope-a:registry=https://packages.org
    @scope-b:registry=https://packages.org
    "
  `)
})

test('custom registry: set registry for specified package scopes (with auth token)', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.scopes = '@scope-a,@scope-b'
  actionInput.token = 'registry-token'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith('/source/.npmrc', expect.any(String))
  expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "//packages.org/:_authToken=registry-token
    //packages.org/:always-auth=true
    @scope-a:registry=https://packages.org
    @scope-b:registry=https://packages.org
    "
  `)
})

test('custom registry: github specific - registry URL with path', async () => {
  actionInput.registry = 'https://packages.org/scope'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith('/source/.npmrc', expect.any(String))
  expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "registry=https://packages.org/scope
    "
  `)
})

test('custom registry: github specific - scopes should not contain path in registry URL', async () => {
  actionInput.registry = 'https://packages.org/scope'
  actionInput.scopes = '@scope-a,@scope-b'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith('/source/.npmrc', expect.any(String))
  expect(getNpmRcContent()).toMatchInlineSnapshot(`
    "@scope-a:registry=https://packages.org
    @scope-b:registry=https://packages.org
    "
  `)
})

test('throw error if input version not semver compliant', async () => {
  actionInput.version = '007'

  await expect(main()).rejects.toBeInstanceOf(Error)
})
