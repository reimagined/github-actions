import { execSync } from 'child_process'
import { unlinkSync } from 'fs'
import * as core from '@actions/core'
import { mocked } from 'ts-jest/utils'
import { unpublish } from '../src/unpublish'
import { post } from '../src/post'

jest.mock('../src/unpublish')
jest.mock('@actions/core')
jest.mock('child_process')
jest.mock('fs')

const mExec = mocked(execSync)
const mUnpublish = mocked(unpublish)
const mCoreGetState = mocked(core.getState)
const mCoreGetInput = mocked(core.getInput)
const mUnlink = mocked(unlinkSync)

let originalArgv = process.argv
let jobState: { [key: string]: string }
let actionInput: { [key: string]: string }

beforeEach(() => {
  jobState = {
    version: '1.2.3',
    npmrc_file: 'npm-rc-file',
  }
  actionInput = {
    unpublish: 'yes',
  }

  mCoreGetState.mockImplementation((name) => jobState[name])
  mCoreGetInput.mockImplementation((name) => actionInput[name])
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

test('self-invoke on workspaces in "unpublish" mode', async () => {
  process.argv = ['node', 'index.js']

  await post()

  expect(mExec).toHaveBeenCalled()
  expect(mExec.mock.calls[0][0]).toMatchInlineSnapshot(
    `"yarn workspaces run \\"node index.js unpublish --version=1.2.3\\""`
  )
})

test('do not unpublish if "unpublish" input does not set to positive value', async () => {
  actionInput.unpublish = 'false'

  await post()

  expect(mExec).not.toHaveBeenCalled()
})

test('npmrc file removed', async () => {
  await post()

  expect(mUnlink).toHaveBeenCalledWith('npm-rc-file')
})

test('skip npmrc file remove if no file name within state', async () => {
  jobState.npmrc_file = ''

  await post()

  expect(mUnlink).not.toHaveBeenCalled()
})
