import { mocked } from 'ts-jest/utils'
import * as core from '@actions/core'
import omit from 'lodash.omit'
import { getCLI } from '../../common/src/cli'
import { CLI } from '../../common/src/types'
import { post } from '../src/post'

jest.mock('../../common/src/cli')
jest.mock('@actions/core')

const mCoreGetState = mocked(core.getState)
const mCoreGetInput = mocked(core.getInput)
const mGetCLI = mocked(getCLI)

let jobState: { [key: string]: string }
let actionInput: { [key: string]: string }
let mCLI: jest.MockedFunction<CLI>

beforeEach(() => {
  jobState = {
    app_id: 'deployment-id',
    app_dir: '/source/dir',
  }
  actionInput = {
    retrieve_logs_on_post_job: 'false',
  }

  mCoreGetState.mockImplementation((name) => jobState[name])
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mCLI = jest.fn()
  mGetCLI.mockReturnValue(mCLI)
})

test('tolerate to script execution errors', async () => {
  mCLI.mockImplementationOnce(() => {
    throw Error(`error`)
  })

  await post()
})

test('cloud CLI requested', async () => {
  await post()

  expect(mGetCLI).toHaveBeenCalledWith('/source/dir', undefined)
})

test('cloud CLI requested for specific sources', async () => {
  actionInput.cli_sources = '/cli/sources'

  await post()

  expect(mGetCLI).toHaveBeenCalledWith('/source/dir', '/cli/sources')
})

test('invoke cloud application deletion', async () => {
  await post()

  expect(mCLI).toHaveBeenCalledWith(
    'rm deployment-id --with-event-store',
    expect.anything()
  )
})

test('do nothing if no app-id stored in state', async () => {
  jobState = omit(jobState, 'app_id')

  await post()

  expect(mGetCLI).not.toHaveBeenCalled()
  expect(mCLI).not.toHaveBeenCalled()
})

test('do nothing if no app directory stored in state', async () => {
  jobState = omit(jobState, 'app_id')

  await post()

  expect(mGetCLI).not.toHaveBeenCalled()
  expect(mCLI).not.toHaveBeenCalled()
})

test('retrieve deployment logs if retrieve_logs option set', async () => {
  actionInput = {
    retrieve_logs: 'true',
  }

  await post()

  expect(mGetCLI).toHaveBeenCalled()
  expect(mCLI).toHaveBeenCalledWith(`logs deployment-id`, `inherit`)
})
