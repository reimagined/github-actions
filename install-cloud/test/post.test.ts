import { execSync } from 'child_process'
import { mocked } from 'ts-jest/utils'
import * as core from '@actions/core'
import { post } from '../src/post'
import omit from 'lodash.omit'

jest.mock('@actions/core')
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

const mCoreGetState = mocked(core.getState)
const mCoreGetInput = mocked(core.getInput)
const mCoreStartGroup = mocked(core.startGroup)
const mCoreEndGroup = mocked(core.endGroup)

let jobState: { [key: string]: string }
let actionInput: { [key: string]: string }

beforeEach(() => {
  jobState = {
    determined_version: 'x.y.z-stage-012345',
  }
  actionInput = {
    aws_access_key_id: 'aws_access_key_id',
    aws_secret_access_key: 'aws_secret_access_key',
    source: './source',
    stage: 'test',
  }

  mCoreGetState.mockImplementation((name) => jobState[name])
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mCoreStartGroup.mockReturnThis()
  mCoreEndGroup.mockReturnThis()
  mocked(execSync).mockClear()
})

test('tolerate to script execution errors', async () => {
  mocked(execSync).mockImplementationOnce(() => {
    throw Error(`error`)
  })

  await post()
})

test('cloud CLI requested', async () => {
  await post()

  expect(execSync).toHaveBeenCalledWith(
    'yarn -s admin-cli version-resources uninstall --stage=test --version=x.y.z-stage-012345',
    expect.any(Object)
  )
})

test('do nothing if no determined_version stored in state', async () => {
  jobState = omit(jobState, 'determined_version')

  await post()

  expect(execSync).not.toHaveBeenCalled()
})
