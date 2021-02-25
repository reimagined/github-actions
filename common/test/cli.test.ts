import { mocked } from 'ts-jest/utils'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import * as os from 'os'
import { getCLI, describeApp, writeResolveRc } from '../src/cli'
import { CLI } from '../src/types'

jest.mock('child_process')
jest.mock('fs')

const mExec = mocked(execSync)
const mWriteFile = mocked(writeFileSync)

const getResolveRcContent = (): string =>
  mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/.resolverc'
  )?.[1] as string

let originalEnv = process.env

beforeEach(() => {
  process.env = {
    process: 'env',
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe('getCLI', () => {
  let cli: CLI

  beforeEach(() => {
    cli = getCLI('/app/dir')
    mExec.mockReturnValue(Buffer.from('execution-result'))
  })

  test('executed cloud cli with default stdio options', () => {
    cli('test')

    expect(mExec).toHaveBeenCalledWith('yarn --silent resolve-cloud test', {
      cwd: '/app/dir',
      stdio: 'pipe',
      env: {
        process: 'env',
      },
    })
  })

  test('cloud cli executed with specified stdio options', () => {
    cli('test', 'inherit')

    expect(mExec).toHaveBeenCalledWith('yarn --silent resolve-cloud test', {
      cwd: '/app/dir',
      stdio: 'inherit',
      env: {
        process: 'env',
      },
    })
  })

  test('execution result returned as string', () => {
    expect(cli('test')).toEqual('execution-result')
  })
})

describe('describeApp', () => {
  let lsOutput: string
  let describeOutput: string
  let cli: jest.MockedFunction<CLI>

  beforeEach(() => {
    lsOutput =
      'ID NAME  VERSION  USERID EVENTSTORE UPDATE' +
      os.EOL +
      'deployment-id my-app  3.1.0   user@mail.com  event-store-id up-to-date'

    describeOutput =
      'id                   deployment-id' +
      os.EOL +
      'name                 my-app' +
      os.EOL +
      'applicationUrl       https://deployment-id.resolve.sh ' +
      os.EOL +
      'staticUrl            https://static.resolve.sh/deployment-id' +
      os.EOL +
      'lastUpdatedAt        1614185948216 ' +
      os.EOL +
      'status               in_progress' +
      os.EOL +
      'error                N\\A ' +
      os.EOL +
      'version              3.1.0 ' +
      os.EOL +
      'eventStore           event-store-id ' +
      os.EOL +
      'update               up-to-date'

    cli = jest.fn()
    cli.mockImplementation((args: string) => {
      if (args.includes('ls')) {
        return lsOutput
      } else if (args.includes('describe')) {
        return describeOutput
      }
      return ''
    })
  })

  test('complete deployment info returned', () => {
    expect(describeApp('my-app', cli)).toEqual({
      deploymentId: 'deployment-id',
      appUrl: 'https://deployment-id.resolve.sh',
      appRuntime: '3.1.0',
      appName: 'my-app',
    })
  })

  test('null returned if "ls" data is empty string', () => {
    lsOutput = ''
    expect(describeApp('my-app', cli)).toEqual(null)
  })

  test('null returned if "ls" return no rows', () => {
    lsOutput = 'ID NAME  VERSION  USERID EVENTSTORE UPDATE'
    expect(describeApp('my-app', cli)).toEqual(null)
  })

  test('null returned if "ls" have not definitions', () => {
    lsOutput =
      'deployment-id my-app  3.1.0   user@mail.com  event-store-id up-to-date'
    expect(describeApp('my-app', cli)).toEqual(null)
  })

  test('null returned if no "describe" data', () => {
    describeOutput = ''
    expect(describeApp('my-app', cli)).toEqual(null)
  })

  test('using core debug logging', () => {
    const core = {
      error: jest.fn(),
      debug: jest.fn(),
    }

    describeApp('my-app', cli, core)

    expect(core.debug).toHaveBeenCalled()
  })

  test('using core error logging: no "ls" info', () => {
    const core = {
      error: jest.fn(),
      debug: jest.fn(),
    }

    lsOutput = ''

    describeApp('my-app', cli, core)

    expect(core.error).toHaveBeenCalled()
  })

  test('using core error logging: no "describe" info', () => {
    const core = {
      error: jest.fn(),
      debug: jest.fn(),
    }

    describeOutput = ''

    describeApp('my-app', cli, core)

    expect(core.error).toHaveBeenCalled()
  })
})

describe('writeResolveRc', () => {
  test('valid rc-file written', () => {
    writeResolveRc(
      '/source/.resolverc',
      'https://api.resolve.sh',
      'user',
      'token'
    )

    expect(getResolveRcContent()).toMatchInlineSnapshot()
  })
})
