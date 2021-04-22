import { mocked } from 'ts-jest/utils'
import { execSync } from 'child_process'
import { Docker } from '../src/types'
import { getDocker } from '../src/docker'

jest.mock('child_process')

const mExec = mocked(execSync)

describe('runSync', () => {
  let docker: Docker

  beforeEach(() => {
    docker = getDocker('ubuntu')
    mExec.mockReturnValue(Buffer.from('execution-result'))
  })

  test('default docker execution', () => {
    expect(docker.run()).toEqual('execution-result')

    expect(mExec).toHaveBeenCalledWith(
      'docker run -it --rm ubuntu',
      expect.any(Object)
    )
  })

  test('executed docker with inherited i/o', () => {
    docker.run({
      stdio: 'inherit',
    })

    expect(mExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        stdio: 'inherit',
      })
    )
  })

  test('executed docker with custom image arguments', () => {
    docker.run({
      args: '--custom --arg=true',
    })

    expect(mExec).toHaveBeenCalledWith(
      'docker run -it --rm ubuntu --custom --arg=true',
      expect.any(Object)
    )
  })

  test('executed docker mount', () => {
    docker.run({
      mounts: [
        {
          host: '/host/path',
          container: '/container/path',
        },
      ],
    })

    expect(mExec).toHaveBeenCalledWith(
      'docker run -it --rm -v /host/path:/container/path ubuntu',
      expect.any(Object)
    )
  })

  test('mount and image args', () => {
    docker.run({
      mounts: [
        {
          host: '/host/path',
          container: '/container/path',
        },
      ],
      args: '--custom --arg=true',
    })

    expect(mExec).toHaveBeenCalledWith(
      'docker run -it --rm -v /host/path:/container/path ubuntu --custom --arg=true',
      expect.any(Object)
    )
  })
})
