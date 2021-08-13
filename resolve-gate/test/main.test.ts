import { mocked } from 'ts-jest/utils'

import { URL } from 'url'
import { readFileSync, writeFileSync } from 'fs'
import * as core from '@actions/core'

import {
  writeNpmRc,
  parseScopes,
  createExecutor,
  bumpDependencies,
} from '../../common/src/utils'
import { Package } from '../../common/src/types'
import { writeResolveRc } from '../../common/src/cli'

import { main } from '../src/main'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('child_process')
jest.mock('../../common/src/utils')
jest.mock('../../common/src/cli')

const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mBumpDependencies = mocked(bumpDependencies)
const mWriteNpmRc = mocked(writeNpmRc)
const mCoreGetInput = mocked(core.getInput)
const mParseScopes = mocked(parseScopes)
const mCreateExecutor = mocked(createExecutor)
const mWriteResolveRc = mocked(writeResolveRc)

const getPackageContent = (): Package | undefined => {
  const data = mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/dir/package.json'
  )?.[1] as string
  if (data) {
    return JSON.parse(data)
  }
}

let actionInput: { [key: string]: string }
let execSync = jest.fn()

beforeEach(() => {
  actionInput = {
    registry: 'https://packages.org',
    token: 'registry-token',
    source: '/source/dir',
    cloud_user: 'cloud-user',
    cloud_token: 'cloud-token',
    registry_package_tag: 'registry-package-tag',
  }
  mCoreGetInput.mockImplementation((name) => actionInput[name] ?? '')
  mParseScopes.mockReturnValue([])
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify(
        {
          name: 'package',
          dependencies: {
            '@resolve-js/package': '0.0.0',
            a: '1.2.3',
          },
        },
        null,
        2
      )
    )
  )
  execSync.mockImplementation((command) => {
    let result = ''
    if (command.includes('yarn -s info')) {
      result = JSON.stringify({
        data: {
          'registry-package-tag': '0.0.0',
        },
      })
    }
    return Buffer.from(result)
  })
  mCreateExecutor.mockImplementation(() => execSync)
})

test('input read', async () => {
  await main()

  expect(mCoreGetInput).toHaveBeenCalledWith('source', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('registry', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('token', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('framework_scope')
  expect(mCoreGetInput).toHaveBeenCalledWith('framework_version')
  expect(mCoreGetInput).toHaveBeenCalledWith('registry_package_tag')
  expect(mCoreGetInput).toHaveBeenCalledWith('cloud_user', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('cloud_token', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('cloud_api_url')
})

test('framework version patched', async () => {
  actionInput.framework_version = '1.2.3'
  actionInput.framework_scope = '@scope'

  mBumpDependencies.mockImplementationOnce((pkg) => ({
    ...pkg,
    dependencies: {
      a: '7.7.7',
    },
  }))

  await main()

  expect(mBumpDependencies).toHaveBeenCalledWith(
    {
      name: 'package',
      dependencies: { '@resolve-js/package': '0.0.0', a: '1.2.3' },
    },
    '@scope/.*$',
    '1.2.3'
  )
  expect(mWriteFile).toHaveBeenCalledWith(
    '/source/dir/package.json',
    expect.any(String)
  )
  expect(getPackageContent()?.dependencies?.a).toEqual('7.7.7')
})

test('write npmrc for custom registry and token', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.token = 'registry-token'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/source/dir/.npmrc',
    new URL('https://packages.org'),
    'registry-token',
    {
      core,
      scopes: [],
    }
  )
})

test('write npmrc for custom registry, token and scopes', async () => {
  actionInput.registry = 'https://packages.org'
  actionInput.token = 'registry-token'
  actionInput.framework_scope = '@scope-a,@scope-b'
  mParseScopes.mockReturnValueOnce(['parsed-scopes'])

  await main()

  expect(mParseScopes).toHaveBeenCalledWith('@scope-a,@scope-b')
  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/source/dir/.npmrc',
    new URL('https://packages.org'),
    'registry-token',
    {
      core,
      scopes: ['parsed-scopes'],
    }
  )
})

test('throw error in registry is invalid URL', async () => {
  actionInput.registry = 'bad-url'

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('throw error in package.json unknown dependencies', async () => {
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify(
        {
          name: 'package',
        },
        null,
        2
      )
    )
  )

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('throw error inputs framework_version and registry_package_tag is undefined', async () => {
  actionInput.framework_version = ''
  actionInput.registry_package_tag = ''

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('throw error incorrect framework_version', async () => {
  actionInput.framework_version = 'incorrect-version'

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('app dependencies installation', async () => {
  await main()

  expect(execSync).toHaveBeenNthCalledWith(3, 'npm install')
})

test('start resolve-gate script', async () => {
  await main()

  expect(execSync).toHaveBeenLastCalledWith(
    'npx ts-node ./ci-scripts/resolve-gate/run-task.ts'
  )
})

test('.resolverc file written with default URL', async () => {
  await main()

  expect(mWriteResolveRc).toHaveBeenLastCalledWith(
    '/source/dir/.resolverc',
    'cloud-user',
    'cloud-token',
    '',
    core
  )
})

test('.resolverc file written with custom URL', async () => {
  actionInput.cloud_api_url = 'https://custom.api.com'

  await main()

  expect(mWriteResolveRc).toHaveBeenLastCalledWith(
    '/source/dir/.resolverc',
    'cloud-user',
    'cloud-token',
    'https://custom.api.com',
    core
  )
})
