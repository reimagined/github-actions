import { readFileSync } from 'fs'
import * as core from '@actions/core'
import * as github from '@actions/github/lib/github'
import { execSync } from 'child_process'
import { mocked } from 'ts-jest/utils'
import { unpublish } from '../src/unpublish'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('fs')
jest.mock('child_process')

const mReadFile = mocked(readFileSync)
const mExec = mocked(execSync)
const mCoreGetState = mocked(core.getState)
const mCoreGetInput = mocked(core.getInput)
const mGetOctokit = mocked(github.getOctokit)
const mGraphql = jest.fn()

let pkg: object
let actionInput: { [key: string]: string }
let jobState: { [key: string]: string }

beforeEach(() => {
  actionInput = {}
  jobState = {}
  pkg = {
    name: 'mock-package',
    version: '1.0.0',
    private: false,
  }
  mReadFile.mockReturnValue(Buffer.from(JSON.stringify(pkg)))
  mExec.mockReturnValue(Buffer.from(''))

  mCoreGetState.mockImplementation((name) => jobState[name])
  mCoreGetInput.mockImplementation((name) => actionInput[name])
  mGetOctokit.mockImplementation((): any => ({
    graphql: mGraphql,
  }))
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

test('github unpublish invoked', async () => {
  jobState = {
    is_github_registry: 'true',
  }
  actionInput = {
    token: 'github-token',
  }

  mGraphql.mockReturnValueOnce({
    repository: {
      packages: {
        nodes: [{ version: { id: 'github-package-version-id' } }],
      },
    },
  })

  await unpublish('2.0.0')

  expect(mExec).not.toHaveBeenCalled()
  expect(mGetOctokit).toHaveBeenCalledWith('github-token')
  expect(mGraphql.mock.calls[0][1]).toEqual({
    packageName: 'mock-package',
    version: '2.0.0',
    headers: {
      Accept: 'application/vnd.github.packages-preview+json',
    },
  })
  expect(mGraphql.mock.calls[1][1]).toEqual({
    packageVersionId: 'github-package-version-id',
    headers: {
      Accept: 'application/vnd.github.package-deletes-preview+json',
    },
  })
})
