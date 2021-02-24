import omit from 'lodash.omit'
import { mocked } from 'ts-jest/utils'
import { readFileSync, writeFileSync } from 'fs'
import * as core from '@actions/core'
import { bumpDependencies } from '../../common/src/utils'
import { main } from '../src/main'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('../../common/src/utils')

const mWriteFile = mocked(writeFileSync)
const mReadFile = mocked(readFileSync)
const mBumpDependencies = mocked(bumpDependencies)
const mCoreGetInput = mocked(core.getInput)

let actionInput: { [key: string]: string }

beforeEach(() => {
  actionInput = {
    source: '/source/dir',
  }
  mCoreGetInput.mockImplementation((name) => actionInput[name])
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
