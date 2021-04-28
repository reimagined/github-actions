import { mocked } from 'ts-jest/utils'
import { ChildProcess, spawn } from 'child_process'
import { Docker } from '../src/types'
import { getDocker } from '../src/docker'

jest.mock('child_process')

const mSpawn = mocked(spawn)

type EventListenerSetter = (event: string, listener: Function) => void
type MockChildProcess = {
  on: EventListenerSetter
  stdout: {
    on: EventListenerSetter
  }
  stderr: {
    on: EventListenerSetter
  }
}

describe('run', () => {
  const enqueueExit = (code: number) =>
    setImmediate(() => {
      listeners['stdout.data'](Buffer.from(`execution-result`))
      listeners['stderr.data'](Buffer.from(`error-result`))
      listeners['exit'](code)
    })

  let docker: Docker
  let process: MockChildProcess
  let listeners: { [key: string]: Function }

  beforeEach(() => {
    docker = getDocker('ubuntu')
    listeners = {}
    process = {
      on: jest.fn((event, listener) => {
        listeners[event] = listener
      }),
      stdout: {
        on: jest.fn((event, listener) => {
          listeners[`stdout.${event}`] = listener
        }),
      },
      stderr: {
        on: jest.fn((event, listener) => {
          listeners[`stderr.${event}`] = listener
        }),
      },
    }
    mSpawn.mockReturnValue(process as ChildProcess)
  })

  test('default docker execution', async () => {
    enqueueExit(0)
    expect(await docker.run()).toEqual('execution-result')

    expect(mSpawn).toHaveBeenCalledWith(
      'docker',
      ['run', '--rm', 'ubuntu'],
      expect.any(Object)
    )
  })

  test('executed docker with inherited i/o', async () => {
    enqueueExit(0)
    await docker.run({
      stdio: 'inherit',
    })

    expect(mSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        stdio: 'inherit',
      })
    )
  })

  test('executed docker with custom image arguments', async () => {
    enqueueExit(0)
    await docker.run({
      args: '--custom --arg=true',
    })

    expect(mSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--custom --arg=true']),
      expect.any(Object)
    )
  })

  test('executed docker mount', async () => {
    enqueueExit(0)
    await docker.run({
      mounts: [
        {
          host: '/host/path',
          container: '/container/path',
        },
      ],
    })

    expect(mSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['-v /host/path:/container/path']),
      expect.any(Object)
    )
  })

  test('mount and image args', async () => {
    enqueueExit(0)
    await docker.run({
      mounts: [
        {
          host: '/host/path',
          container: '/container/path',
        },
      ],
      args: '--custom --arg=true',
    })

    expect(mSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        '-v /host/path:/container/path',
        '--custom --arg=true',
      ]),
      expect.any(Object)
    )
  })

  test('error with stderr', async () => {
    enqueueExit(1)
    try {
      await docker.run()
    } catch (e) {
      expect(e.message).toContain(`code 1`)
      expect(e.message).toContain(`error-result`)
    }
  })
})
