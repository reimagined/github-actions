import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import * as core from '@actions/core'
import { mocked } from 'ts-jest/utils'
import { publish } from '../src/publish'
import { entry } from '../src/entry'

jest.mock('../src/publish')
jest.mock('@actions/core')
jest.mock('child_process')
jest.mock('fs')

const mExec = mocked(execSync)
const mPublish = mocked(publish)
const mCoreGetInput = mocked(core.getInput)
const mCoreSetOutput = mocked(core.setOutput)
const mCoreSaveState = mocked(core.saveState)
const mWriteFile = mocked(writeFileSync)

let originalArgv = process.argv
let actionInput: { [key: string]: string }

beforeEach(() => {
  actionInput = {
    registry: 'github',
    version: '1.2.3',
    tag: 'publish-tag',
  }

  mCoreGetInput.mockImplementation((name) => actionInput[name])
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

  await entry()

  expect(mPublish).toHaveBeenCalledWith('1.0.0', 'nightly')
})

test('publish command does not invoked if no command provided', async () => {
  process.argv = ['node', 'index.js']

  await entry()

  expect(mPublish).not.toHaveBeenCalled()
})

test('npmrc and output for "github" registry', async () => {
  actionInput.registry = 'github'
  actionInput.token = 'github-token'

  await entry()

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
})

test('npmrc and output for "npm" registry', async () => {
  actionInput.registry = 'npm'
  actionInput.token = 'npm-token'

  await entry()

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
})

test('npmrc and output for "npmjs" registry', async () => {
  actionInput.registry = 'npmjs'
  actionInput.token = 'npmjs-token'

  await entry()

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
})
