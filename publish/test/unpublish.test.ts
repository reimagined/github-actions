import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { mocked } from 'ts-jest/utils'
import { unpublish } from '../src/unpublish'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('child_process')

const mReadFile = mocked(readFileSync)
const mExec = mocked(execSync)

let pkg: object

beforeEach(() => {
  pkg = {
    name: 'mock-package',
    version: '1.0.0',
    private: false,
  }
  mReadFile.mockReturnValue(Buffer.from(JSON.stringify(pkg)))
  mExec.mockReturnValue(Buffer.from(''))
})

test('invalid input: bad package version', async () => {
  await expect(unpublish('trash')).rejects.toBeInstanceOf(Error)
  await expect(unpublish('123')).rejects.toBeInstanceOf(Error)
  await expect(unpublish('')).rejects.toBeInstanceOf(Error)
})

test('package.json read', async () => {
  await unpublish('2.0.0')

  expect(mReadFile).toHaveBeenCalledWith('./package.json')
})

test('skip private packages', async () => {
  mReadFile.mockReturnValue(
    Buffer.from(
      JSON.stringify({
        ...pkg,
        private: true,
      })
    )
  )

  await unpublish('2.0.0')

  expect(mExec).not.toHaveBeenCalled()
})

test('npm unpublish invoked', async () => {
  await unpublish('2.0.0')

  expect(mExec.mock.calls[0][0]).toMatchInlineSnapshot(
    `"npm unpublish --force mock-package@2.0.0"`
  )
})

test('tolerate to unpublish errors', async () => {
  mExec.mockImplementation(() => {
    throw Error('script failure')
  })

  await unpublish('2.0.0')
})
