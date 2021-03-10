import { mocked } from 'ts-jest/utils'
import * as core from '@actions/core'
import omit from 'lodash.omit'

import { post } from '../src/post'
import * as utils from '../../common/src/utils'

jest.mock('@actions/core')
jest.mock('../../common/src/utils')

const mCoreGetState = mocked(core.getState)
const mCoreGetInput = mocked(core.getInput)
const mCreateExecutor = mocked(utils.createExecutor)

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
})

test('tolerate to script execution errors', async () => {
  mocked(mCreateExecutor).mockImplementationOnce(() => {
    throw Error(`error`)
  })

  await post()
})

test('cloud CLI requested', async () => {
  const execSync = jest.fn()
  mCreateExecutor.mockReturnValue(execSync)

  await post()

  expect(execSync).toHaveBeenCalledWith(
    'yarn -s admin-cli version-resources uninstall --stage=test --version=x.y.z-stage-012345'
  )
})

test('do nothing if no determined_version stored in state', async () => {
  const execSync = jest.fn()
  mCreateExecutor.mockReturnValue(execSync)

  jobState = omit(jobState, 'determined_version')

  await post()

  expect(execSync).not.toHaveBeenCalled()
})
