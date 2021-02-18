import { ChildProcess, exec } from 'child_process'
import { unlinkSync, copyFileSync } from 'fs'
import * as core from '@actions/core'
import { mocked } from 'ts-jest/utils'
import { unpublish } from '../src/unpublish'
import { post } from '../src/post'
import { processWorkspaces, WorkspaceProcessor } from '../src/utils'

jest.mock('../src/unpublish')
jest.mock('../src/utils')
jest.mock('@actions/core')
jest.mock('child_process')
jest.mock('fs')

const mExec = mocked(exec)
const mUnpublish = mocked(unpublish)
const mCoreGetState = mocked(core.getState)
const mCoreGetInput = mocked(core.getInput)
const mCoreDebug = mocked(core.debug)
const mUnlink = mocked(unlinkSync)
const mCopyFile = mocked(copyFileSync)
const mProcessWorkspaces = mocked(processWorkspaces)

let originalArgv = process.argv
let jobState: { [key: string]: string }
let actionInput: { [key: string]: string }

beforeEach(() => {
  jobState = {
    version: '1.2.3',
    npmrc_file: 'npm-rc-file',
    npmrc_backup: 'npm-rc-backup',
  }
  actionInput = {
    unpublish: 'yes',
  }

  mCoreGetState.mockImplementation((name) => jobState[name])
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mExec.mockImplementation((command, options, callback) => {
    callback?.(null, 'executed', '')
    return {} as ChildProcess
  })
})

afterEach(() => {
  process.argv = originalArgv
})

test('unpublish command invoked', async () => {
  process.argv = ['node', 'index.js', 'unpublish', '--version=1.0.0']

  await post()

  expect(mUnpublish).toHaveBeenCalledWith('1.0.0')
})

test('unpublish command does not invoked if no command provided', async () => {
  process.argv = ['node', 'index.js']

  await post()

  expect(mUnpublish).not.toHaveBeenCalled()
})

test('throw error if no version within job state', async () => {
  jobState.version = ''

  await expect(post()).rejects.toBeInstanceOf(Error)
})

test('workspace processor', async () => {
  process.argv = ['node', 'index.js']

  await post()

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
    `"node index.js unpublish --version=1.2.3"`
  )
})

test('workspace processor failure', async () => {
  await post()

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

test('workspace processor skip debug output of stdout if its empty', async () => {
  await post()

  const processor: WorkspaceProcessor = mProcessWorkspaces.mock.calls[0][0]

  mExec.mockImplementationOnce((command, options, callback) => {
    callback?.(null, '', '')
    return {} as ChildProcess
  })

  mCoreDebug.mockClear()

  await processor({
    name: 'mock-package',
    location: '/path/to/package',
    pkg: {
      name: 'mock-package',
    },
  })

  expect(mCoreDebug).not.toHaveBeenCalledWith('')
})

test('do not unpublish if "unpublish" input does not set to positive value', async () => {
  actionInput.unpublish = 'false'

  await post()

  expect(mProcessWorkspaces).not.toHaveBeenCalled()
})

test('npmrc file removed and restored from backup', async () => {
  await post()

  expect(mUnlink).toHaveBeenCalledWith('npm-rc-file')
  expect(mCopyFile).toHaveBeenCalledWith(`npm-rc-backup`, `npm-rc-file`)
  expect(mUnlink).toHaveBeenCalledWith('npm-rc-backup')
})

test('skip restore from backup if no backup file within state', async () => {
  jobState.npmrc_backup = ''

  await post()

  expect(mCopyFile).not.toHaveBeenCalled()
})

test('skip npmrc file remove if no file name within state', async () => {
  jobState.npmrc_file = ''

  await post()

  expect(mUnlink).not.toHaveBeenCalled()
})
