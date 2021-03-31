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
import { getCLI, describeApp, writeResolveRc } from '../../common/src/cli'
import { CLI, Package } from '../../common/src/types'
import { main } from '../src/main'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('child_process')
jest.mock('latest-version')
jest.mock('../../common/src/utils')
jest.mock('../../common/src/cli')

const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mBumpDependencies = mocked(bumpDependencies)
const mWriteNpmRc = mocked(writeNpmRc)
const mCoreGetInput = mocked(core.getInput)
const mCoreSetOutput = mocked(core.setOutput)
const mCoreSaveState = mocked(core.saveState)
const mParseScopes = mocked(parseScopes)
const mExec = mocked(execSync)
const mParseBoolean = mocked(parseBoolean)
const mLatestVersion = mocked(latestVersion)
const mGetCLI = mocked(getCLI)
const mWriteResolveRc = mocked(writeResolveRc)
const mDescribeApp = mocked(describeApp)

const getPackageContent = (): Package | undefined => {
  const data = mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/dir/package.json'
  )?.[1] as string
  if (data) {
    return JSON.parse(data)
  }
}

let actionInput: { [key: string]: string }
let mCLI: jest.MockedFunction<CLI>

beforeEach(() => {
  actionInput = {
    source: '/source/dir',
    cloud_user: 'cloud-user',
    cloud_token: 'cloud-token',
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
  mCLI = jest.fn()
  mGetCLI.mockReturnValue(mCLI)
})

test('input read', async () => {
  await main()

  expect(mCoreGetInput).toHaveBeenCalledWith('source', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('name')
  expect(mCoreGetInput).toHaveBeenCalledWith('cloud_user', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('cloud_token', { required: true })
  expect(mCoreGetInput).toHaveBeenCalledWith('cloud_api_url')
  expect(mCoreGetInput).toHaveBeenCalledWith('package_registry')
  expect(mCoreGetInput).toHaveBeenCalledWith('framework_version')
  expect(mCoreGetInput).toHaveBeenCalledWith('cli_version')
  expect(mCoreGetInput).toHaveBeenCalledWith('events_file_path')
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

  expect(mReadFile).toHaveBeenCalledWith('/source/dir/package.json')
  expect(mBumpDependencies).toHaveBeenCalledWith(
    { name: 'package', dependencies: { a: '1.2.3' } },
    '@scope/.*$',
    '1.2.3'
  )
  expect(mWriteFile).toHaveBeenCalledWith(
    '/source/dir/package.json',
    expect.any(String)
  )
  expect(getPackageContent()?.dependencies?.a).toEqual('7.7.7')
})

test('framework version patched (cli_sources set)', async () => {
  actionInput.framework_version = '1.2.3'
  actionInput.cli_sources = '/path/to/cli'

  mBumpDependencies.mockImplementationOnce((pkg) => ({
    ...pkg,
    dependencies: {
      a: '7.7.7',
    },
  }))

  await main()

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

test('cloud cli version patched to latest available (specific version is empty string)', async () => {
  actionInput.cli_version = ''

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

test('ambiguous options: cli_package and cli_sources options both set', async () => {
  actionInput.cli_version = '5.4.3'
  actionInput.cli_sources = '/path/to/cli'

  await expect(main()).rejects.toThrow()
})

test('cloud cli version does not patched if sources was set', async () => {
  actionInput.cli_sources = '/path/to/cli'

  await main()

  expect(mLatestVersion).not.toHaveBeenCalledWith('resolve-cloud')
  expect(
    getPackageContent()?.devDependencies?.['resolve-cloud']
  ).toBeUndefined()
})

test('write npmrc for custom registry', async () => {
  actionInput.package_registry = 'https://packages.org'

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

  expect(mCoreGetInput).toHaveBeenCalledWith('package_registry_scopes')
  expect(mCoreGetInput).toHaveBeenCalledWith('package_registry_token')
})

test('write npmrc for custom registry and token', async () => {
  actionInput.package_registry = 'https://packages.org'
  actionInput.package_registry_token = 'registry-token'

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
  actionInput.package_registry = 'https://packages.org'
  actionInput.package_registry_token = 'registry-token'
  actionInput.package_registry_scopes = '@scope-a,@scope-b'
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
  actionInput.package_registry = 'bad-url'

  await expect(main()).rejects.toBeInstanceOf(Error)
})

test('app dependencies installation', async () => {
  await main()

  expect(mExec).toHaveBeenCalledWith('yarn install --frozen-lockfile', {
    cwd: '/source/dir',
    stdio: 'inherit',
  })
})

test('cloud CLI requested', async () => {
  await main()

  expect(mGetCLI).toHaveBeenCalledWith('/source/dir', undefined)
})

test('cloud CLI requested for specific sources', async () => {
  actionInput.cli_sources = '/cli/sources'

  await main()

  expect(mGetCLI).toHaveBeenCalledWith('/source/dir', '/cli/sources')
})

test('app name from input', async () => {
  actionInput.name = 'app-name'
  actionInput.randomize_name = 'false'

  await main()

  expect(mCLI).toHaveBeenCalledWith(
    expect.stringContaining(`--name app-name`),
    expect.anything()
  )
})

test('randomized app name from input', async () => {
  actionInput.name = 'app-name'
  actionInput.randomize_name = 'true'

  const mRandom = jest.spyOn(Math, 'random')
  mRandom.mockReturnValue(777)

  await main()

  expect(mRandom).toHaveBeenCalled()
  expect(mCLI).toHaveBeenCalledWith(
    expect.stringContaining(`--name app-name-777000000`),
    expect.anything()
  )

  mRandom.mockRestore()
})

test('app name from package.json', async () => {
  actionInput.randomize_name = 'false'

  await main()

  expect(mCLI).toHaveBeenCalledWith(
    expect.stringContaining(`--name package`),
    expect.anything()
  )
})

test('app name from package.json (input is empty string)', async () => {
  actionInput.name = ''
  actionInput.randomize_name = 'false'

  await main()

  expect(mCLI).toHaveBeenCalledWith(
    expect.stringContaining(`--name package`),
    expect.anything()
  )
})

test('randomized app name from package.json', async () => {
  actionInput.randomize_name = 'true'

  const mRandom = jest.spyOn(Math, 'random')
  mRandom.mockReturnValue(777)

  await main()

  expect(mRandom).toHaveBeenCalled()
  expect(mCLI).toHaveBeenCalledWith(
    expect.stringContaining(`--name package-777000000`),
    expect.anything()
  )

  mRandom.mockRestore()
})

test('.resolverc file written with default URL', async () => {
  await main()

  expect(mWriteResolveRc).toHaveBeenLastCalledWith(
    '/source/dir/.resolverc',
    'cloud-user',
    'cloud-token',
    undefined,
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

test('.resolverc not written in local_run mode', async () => {
  actionInput.local_run = 'true'

  await main()

  expect(mWriteResolveRc).not.toHaveBeenCalled()

  expect(mCoreGetInput).toHaveBeenCalledWith('local_run')
})

test('deployed application info retrieved and set to output', async () => {
  mDescribeApp.mockReturnValueOnce({
    name: 'app-name',
    runtime: 'app-runtime',
    url: 'https://app-url.com',
    id: 'app-id',
    eventStoreId: 'event-store-id',
  })

  await main()

  expect(mDescribeApp).toHaveBeenCalledWith('package', mCLI, core)
  expect(mCoreSetOutput).toHaveBeenCalledWith('id', 'app-id')
  expect(mCoreSetOutput).toHaveBeenCalledWith('name', 'app-name')
  expect(mCoreSetOutput).toHaveBeenCalledWith('runtime', 'app-runtime')
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'event_store_id',
    'event-store-id'
  )
})

test('deployed application info retrieved and saved to state', async () => {
  mDescribeApp.mockReturnValueOnce({
    name: 'app-name',
    runtime: 'app-runtime',
    url: 'https://app-url.com',
    id: 'app-id',
    eventStoreId: 'event-store-id',
  })

  await main()

  expect(mDescribeApp).toHaveBeenCalledWith('package', mCLI, core)
  expect(mCoreSaveState).toHaveBeenCalledWith('app_id', 'app-id')
  expect(mCoreSaveState).toHaveBeenCalledWith('app_dir', '/source/dir')
})

test('deployed application info retrieved on failed deploy operation', async () => {
  mDescribeApp.mockReturnValueOnce({
    name: 'app-name',
    runtime: 'app-runtime',
    url: 'https://app-url.com',
    id: 'app-id',
    eventStoreId: 'event-store-id',
  })

  mCLI.mockImplementationOnce(() => {
    throw Error('deploy failed')
  })

  try {
    await main()
  } catch {}

  expect(mDescribeApp).toHaveBeenCalledWith('package', mCLI, core)
  expect(mCoreSetOutput).toHaveBeenCalledWith('id', 'app-id')
  expect(mCoreSetOutput).toHaveBeenCalledWith('name', 'app-name')
  expect(mCoreSetOutput).toHaveBeenCalledWith('runtime', 'app-runtime')
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'event_store_id',
    'event-store-id'
  )
})

test('deployed application with events file', async () => {
  actionInput.events_file_path = './test-events.txt'

  mDescribeApp.mockReturnValueOnce({
    name: 'app-name',
    runtime: 'app-runtime',
    url: 'https://app-url.com',
    id: 'app-id',
    eventStoreId: 'te12st',
  })

  mCLI.mockReturnValueOnce(`
    ℹ Event store ID: te12st
    ✔ Event store with "te12st" id has been created
  `)

  await main()

  expect(mCLI).toHaveBeenCalledWith(
    'event-stores incremental-import te12st ./test-events.txt',
    'inherit'
  )

  expect(mCLI).toHaveBeenCalledWith(
    'deploy --name package --event-store-id te12st',
    'inherit'
  )
})

test('fix: specifying CLI sources should remove dev dependencies', async () => {
  actionInput.cli_sources = '/cli/sources'
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify(
        {
          name: 'package',
          devDependencies: {
            'resolve-cloud': '*',
          },
        },
        null,
        2
      )
    )
  )

  await main()

  expect(getPackageContent()?.devDependencies).toEqual({})
})
