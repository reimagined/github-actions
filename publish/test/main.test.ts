import { ChildProcess, exec } from 'child_process'
import { writeFileSync } from 'fs'
import * as core from '@actions/core'
import { mocked } from 'ts-jest/utils'
import { publish } from '../src/publish'
import { processWorkspaces, WorkspaceProcessor } from '../src/utils'
import { main } from '../src/main'

jest.mock('../src/publish')
jest.mock('../src/utils')
jest.mock('@actions/core')
jest.mock('child_process')
jest.mock('fs')

const mExec = mocked(exec)
const mPublish = mocked(publish)
const mCoreGetInput = mocked(core.getInput)
const mCoreSetOutput = mocked(core.setOutput)
const mCoreSaveState = mocked(core.saveState)
const mWriteFile = mocked(writeFileSync)
const mProcessWorkspaces = mocked(processWorkspaces)

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
})

afterEach(() => {
  process.argv = originalArgv
})

test('publish command invoked', async () => {
  process.argv = [
    'node',
    'index.js',
    'publish',
    '--version=1.0.0',
    '--tag=nightly',
  ]

  await main()

  expect(mPublish).toHaveBeenCalledWith('1.0.0', 'nightly')
})

test('publish command does not invoked if no command provided', async () => {
  process.argv = ['node', 'index.js']

  await main()

  expect(mPublish).not.toHaveBeenCalled()
})

test('npmrc and output for "github" registry', async () => {
  actionInput.registry = 'github'
  actionInput.token = 'github-token'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith(
    `${process.cwd()}/.npmrc`,
    expect.any(String)
  )
  expect(mWriteFile.mock.calls[0][1]).toMatchInlineSnapshot(`
    "//npm.pkg.github.com/:_authToken=github-token
    //npm.pkg.github.com/:always-auth=true
    registry=https://npm.pkg.github.com/
    "
  `)
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://npm.pkg.github.com/'
  )
})

test('npmrc and output for "npm" registry', async () => {
  actionInput.registry = 'npm'
  actionInput.token = 'npm-token'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith(
    `${process.cwd()}/.npmrc`,
    expect.any(String)
  )
  expect(mWriteFile.mock.calls[0][1]).toMatchInlineSnapshot(`
    "//registry.npmjs.org/:_authToken=npm-token
    //registry.npmjs.org/:always-auth=true
    registry=https://registry.npmjs.org/
    "
  `)
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://registry.npmjs.org/'
  )
})

test('npmrc and output for "npmjs" registry', async () => {
  actionInput.registry = 'npmjs'
  actionInput.token = 'npmjs-token'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith(
    `${process.cwd()}/.npmrc`,
    expect.any(String)
  )
  expect(mWriteFile.mock.calls[0][1]).toMatchInlineSnapshot(`
    "//registry.npmjs.org/:_authToken=npmjs-token
    //registry.npmjs.org/:always-auth=true
    registry=https://registry.npmjs.org/
    "
  `)
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'https://registry.npmjs.org/'
  )
})

test('npmrc and output for custom registry', async () => {
  actionInput.registry = 'http://resolve-dev.ml:10080'
  actionInput.token = 'resolve-token'

  await main()

  expect(mWriteFile).toHaveBeenCalledWith(
    `${process.cwd()}/.npmrc`,
    expect.any(String)
  )
  expect(mWriteFile.mock.calls[0][1]).toMatchInlineSnapshot(`
    "//resolve-dev.ml:10080/:_authToken=resolve-token
    //resolve-dev.ml:10080/:always-auth=true
    registry=http://resolve-dev.ml:10080/
    "
  `)
  expect(mCoreSetOutput).toHaveBeenCalledWith(
    'registry_url',
    'http://resolve-dev.ml:10080/'
  )
})

test('invalid input: bad registry URL', async () => {
  actionInput.registry = 'bad-registry'

  await expect(main()).rejects.toBeInstanceOf(Error)

  expect(mPublish).not.toHaveBeenCalled()
})

test('action state saved for post-job hook', async () => {
  await main()

  expect(mCoreSaveState).toHaveBeenCalledWith(
    'npmrc_file',
    `${process.cwd()}/.npmrc`
  )
  expect(mCoreSaveState).toHaveBeenCalledWith('version', '1.2.3')
  expect(mCoreSaveState).toHaveBeenCalledWith('tag', 'publish-tag')
})

test('action output (except registry)', async () => {
  await main()

  expect(mCoreSetOutput).toHaveBeenCalledWith('version', '1.2.3')
  expect(mCoreSetOutput).toHaveBeenCalledWith('tag', 'publish-tag')
})

test('workspace processor', async () => {
  process.argv = ['node', 'index.js']

  await main()

  expect(mProcessWorkspaces).toHaveBeenCalled()
  const processor: WorkspaceProcessor = mProcessWorkspaces.mock.calls[0][0]

  await processor({
    name: 'mock-package',
    location: '/path/to/package',
    pkg: {
      name: 'mock-package',
    },
  })

  expect(mExec).toHaveBeenCalled()
  expect(mExec.mock.calls[0][0]).toMatchInlineSnapshot(
    `"node index.js publish --version=1.2.3 --tag=publish-tag"`
  )
})

test('workspace processor (no tag)', async () => {
  actionInput.tag = ''
  process.argv = ['node', 'index.js']

  await main()

  expect(mProcessWorkspaces).toHaveBeenCalled()
  const processor: WorkspaceProcessor = mProcessWorkspaces.mock.calls[0][0]

  await processor({
    name: 'mock-package',
    location: '/path/to/package',
    pkg: {
      name: 'mock-package',
    },
  })

  expect(mExec).toHaveBeenCalled()
  expect(mExec.mock.calls[0][0]).toMatchInlineSnapshot(
    `"node index.js publish --version=1.2.3"`
  )
})

test('workspace processor failure', async () => {
  await main()

  expect(mProcessWorkspaces).toHaveBeenCalled()
  const processor: WorkspaceProcessor = mProcessWorkspaces.mock.calls[0][0]

  mExec.mockImplementationOnce((command, options, callback) => {
    callback?.(Error('failure'), '', '')
    return {} as ChildProcess
  })

  await expect(
    processor({
      name: 'mock-package',
      location: '/path/to/package',
      pkg: {
        name: 'mock-package',
      },
    })
  ).rejects.toBeInstanceOf(Error)
})
