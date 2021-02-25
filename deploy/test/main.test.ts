import { URL } from 'url'
import omit from 'lodash.omit'
import { mocked } from 'ts-jest/utils'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import latestVersion from 'latest-version'
import * as core from '@actions/core'
import {
  bumpDependencies,
  writeNpmRc,
  parseScopes,
  parseBoolean,
} from '../../common/src/utils'
import { Package } from '../../common/src/types'
import { main } from '../src/main'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('child_process')
jest.mock('latest-version')
jest.mock('../../common/src/utils')

const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mBumpDependencies = mocked(bumpDependencies)
const mWriteNpmRc = mocked(writeNpmRc)
const mCoreGetInput = mocked(core.getInput)
const mParseScopes = mocked(parseScopes)
const mExec = mocked(execSync)
const mParseBoolean = mocked(parseBoolean)
const mLatestVersion = mocked(latestVersion)

const getPackageContent = (): Package | undefined => {
  const data = mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/dir/package.json'
  )?.[1] as string
  if (data) {
    return JSON.parse(data)
  }
}

let actionInput: { [key: string]: string }

beforeEach(() => {
  actionInput = {
    source: '/source/dir',
  }
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mParseScopes.mockReturnValue([])
  mParseBoolean.mockImplementation((val) => val === 'true')
  mLatestVersion.mockResolvedValue('1.2.3')
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify(
        {
          name: 'package',
          dependencies: {
            a: '1.2.3',
          },
        },
        null,
        2
      )
    )
  )
})

test('framework version patched', async () => {
  actionInput.framework_version = '1.2.3'

  mBumpDependencies.mockImplementationOnce((pkg) => ({
    ...pkg,
    dependencies: {
      a: '7.7.7',
    },
  }))

  await main()

  expect(mReadFile).toHaveBeenCalledWith('/source/dir/package.json')
  expect(mBumpDependencies).toHaveBeenCalledWith(
    { name: 'package', dependencies: { a: '1.2.3' } },
    '@reimagined/.*$',
    '1.2.3'
  )
  expect(mWriteFile).toHaveBeenCalledWith(
    '/source/dir/package.json',
    expect.any(String)
  )
  expect(getPackageContent()?.dependencies?.a).toEqual('7.7.7')
})

test('skip package.json patch if no framework version provided', async () => {
  actionInput = omit(actionInput)

  await main()

  expect(mBumpDependencies).not.toHaveBeenCalled()
  expect(getPackageContent()?.name).toEqual('package')
})

test('skip package.json patch if empty string provided as framework version', async () => {
  actionInput.framework_version = ' '

  await main()

  expect(mBumpDependencies).not.toHaveBeenCalled()
  expect(getPackageContent()?.name).toEqual('package')
})

test('cloud cli version patched to latest available', async () => {
  await main()

  expect(mLatestVersion).toHaveBeenCalledWith('resolve-cloud')
  expect(getPackageContent()?.devDependencies?.['resolve-cloud']).toEqual(
    '1.2.3'
  )
})

test('cloud cli version patched to specific version', async () => {
  actionInput.cli_version = '5.4.3'

  await main()

  expect(mLatestVersion).not.toHaveBeenCalledWith('resolve-cloud')
  expect(getPackageContent()?.devDependencies?.['resolve-cloud']).toEqual(
    '5.4.3'
  )
})

test('write npmrc for custom registry', async () => {
  actionInput.registry = 'https://packages.org'

  await main()

  expect(mWriteNpmRc).toHaveBeenCalledWith(
    '/source/dir/.npmrc',
    new URL('https://packages.org'),
    undefined,
    {
      core,
      scopes: [],
    }
  )
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
  actionInput.scopes = '@scope-a,@scope-b'
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

test('app dependencies installation', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith('yarn install --frozen-lockfile', {
    cwd: '/source/dir',
    stdio: 'inherit',
  })
})

test('app name from input', async () => {
  actionInput.name = 'app-name'
  actionInput.randomize = 'false'

  await main()
})

test('randomized app name from input', async () => {

})

test('app name from package.json', async () => {})

test('randomized app name from package.json', async () => {})
