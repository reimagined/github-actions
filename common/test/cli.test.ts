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

const getResolveRcContent = (): any => {
  const data = mWriteFile.mock.calls.find(
    (call) => call[0] === '/source/.resolverc'
  )?.[1] as string
  if (data) {
    return JSON.parse(data)
  }
  return null
}

let originalEnv = process.env

beforeEach(() => {
  process.env = {
    process: 'env',
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe('getCLI (package)', () => {
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

describe('getCLI (sources)', () => {
  let cli: CLI

  beforeEach(() => {
    cli = getCLI('/app/dir', '/cli/sources')
    mExec.mockReturnValue(Buffer.from('execution-result'))
  })

  test('executed cloud cli with default stdio options', () => {
    cli('test')

    expect(mExec).toHaveBeenCalledWith('node /cli/sources/lib/index.js test', {
      cwd: '/app/dir',
      stdio: 'pipe',
      env: {
        process: 'env',
      },
    })
  })

  test('cloud cli executed with specified stdio options', () => {
    cli('test', 'inherit')

    expect(mExec).toHaveBeenCalledWith('node /cli/sources/lib/index.js test', {
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
      'APPLICATION-NAME    DEPLOYMENT-ID    DOMAIN    VERSION    EVENT-STORE-ID    TAG' +
      os.EOL +
      'my-app deployment-id  resolve.sh 3.1.0  event-store-id app-tag'

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
      id: 'deployment-id',
      url: 'https://deployment-id.resolve.sh',
      runtime: '3.1.0',
      name: 'my-app',
      eventStore: 'event-store-id',
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
  test('valid rc-file written with default API URL', () => {
    writeResolveRc('/source/.resolverc', 'user', 'token')

    expect(getResolveRcContent()).toMatchInlineSnapshot(`
      Object {
        "api_url": "https://api.resolve.sh/",
        "credentials": Object {
          "refresh_token": "token",
          "user": "user",
        },
      }
    `)
  })

  test('custom API URL', () => {
    writeResolveRc(
      '/source/.resolverc',
      'user',
      'token',
      'https://api.custom.com'
    )

    expect(getResolveRcContent().api_url).toEqual('https://api.custom.com/')
  })

  test('error thrown if custom API URL is invalid', () => {
    expect(() =>
      writeResolveRc('/source/.resolverc', 'user', 'token', 'bla-bla')
    ).toThrow()
  })

  test('error thrown if empty target file path', () => {
    expect(() => writeResolveRc('', 'user', 'token')).toThrow()
  })

  test('error thrown if empty user', () => {
    expect(() => writeResolveRc('/source/.resolverc', '', 'token')).toThrow()
  })

  test('error thrown if empty toke', () => {
    expect(() => writeResolveRc('/source/.resolverc', 'user', '')).toThrow()
  })

  test('core debug logging used', () => {
    const core = {
      debug: jest.fn(),
    }

    writeResolveRc(
      '/source/.resolverc',
      'user',
      'token',
      'https://custom.api.org',
      core
    )

    expect(core.debug).toHaveBeenCalled()
  })
})
