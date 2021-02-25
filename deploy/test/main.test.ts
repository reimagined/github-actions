import { URL } from 'url'
import omit from 'lodash.omit'
import { mocked } from 'ts-jest/utils'
import { readFileSync, writeFileSync } from 'fs'
import * as core from '@actions/core'
import {
  bumpDependencies,
  writeNpmRc,
  parseScopes,
} from '../../common/src/utils'
import { main } from '../src/main'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('../../common/src/utils')

const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mBumpDependencies = mocked(bumpDependencies)
const mWriteNpmRc = mocked(writeNpmRc)
const mCoreGetInput = mocked(core.getInput)
const mParseScopes = mocked(parseScopes)

let actionInput: { [key: string]: string }

beforeEach(() => {
  actionInput = {
    source: '/source/dir',
  }
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mParseScopes.mockReturnValue([])
})

test('framework version patched', async () => {
  actionInput.framework_version = '1.2.3'

  mReadFile.mockReturnValueOnce(
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
  mBumpDependencies.mockReturnValueOnce({
    name: 'patched',
  })

  await main()

  expect(mReadFile).toHaveBeenCalledWith('/source/dir/package.json')
  expect(mBumpDependencies).toHaveBeenCalledWith(
    { name: 'package' },
    '@reimagined/.*$',
    '1.2.3'
  )
  expect(mWriteFile).toHaveBeenCalledWith(
    '/source/dir/package.json',
    JSON.stringify(
      {
        name: 'patched',
      },
      null,
      2
    )
  )
})

test('skip package.json patch if no framework version provided', async () => {
  actionInput = omit(actionInput)

  await main()

  expect(mReadFile).not.toHaveBeenCalledWith('/source/dir/package.json')
  expect(mBumpDependencies).not.toHaveBeenCalled()
  expect(mWriteFile).not.toHaveBeenCalledWith(
    '/source/dir/package.json',
    expect.anything()
  )
})

test('skip package.json patch if empty string provided as framework version', async () => {
  actionInput.framework_version = ' '

  await main()

  expect(mReadFile).not.toHaveBeenCalledWith('/source/dir/package.json')
  expect(mBumpDependencies).not.toHaveBeenCalled()
  expect(mWriteFile).not.toHaveBeenCalledWith(
    '/source/dir/package.json',
    expect.anything()
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
