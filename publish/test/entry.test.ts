import { mocked } from 'ts-jest/utils'
import { publish } from '../src/publish'
import { entry } from '../src/entry'

jest.mock('../src/publish')

const mPublish = mocked(publish)

let originalArgv = process.argv

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
