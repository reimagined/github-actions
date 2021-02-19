import { mocked } from 'ts-jest/utils'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as process from 'process'
import {
  bumpDependencies,
  processWorkspaces,
  WorkspaceProcessor,
} from '../src/utils'

jest.mock('child_process')
jest.mock('fs')
jest.mock('process')

const mExec = mocked(execSync)
const mReadFile = mocked(readFileSync)
const mProcessCWD = mocked(process.cwd)

describe('bumpDependencies', () => {
  test('bump [dependencies]', () => {
    const result = bumpDependencies(
      {
        dependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      dependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [devDependencies]', () => {
    const result = bumpDependencies(
      {
        devDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      devDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [peerDependencies]', () => {
    const result = bumpDependencies(
      {
        peerDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      peerDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [optionalDependencies]', () => {
    const result = bumpDependencies(
      {
        optionalDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3'
    )

    expect(result).toEqual({
      optionalDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })
})

describe('processWorkspaces', () => {
  let output: string
  let processor: jest.MockedFunction<WorkspaceProcessor>

  beforeEach(() => {
    output = JSON.stringify({
      'package-a': {
        location: '/path/to/a',
      },
      'package-b': {
        location: '/path/to/b',
      },
    })
    mExec.mockReturnValue(Buffer.from(output))
    processor = jest.fn()
    mReadFile.mockImplementation((file) =>
      Buffer.from(
        JSON.stringify({
          name: path.dirname(file.toString()),
        })
      )
    )
    mProcessCWD.mockReturnValue('/current-directory')
  })

  test('yarn workspaces info requested in current directory', async () => {
    await processWorkspaces(processor, jest.fn())

    expect(mExec).toHaveBeenCalledWith(expect.any(String), {
      cwd: '/current-directory',
    })
    expect(mExec.mock.calls[0][0]).toMatchInlineSnapshot(
      `"yarn --silent workspaces info"`
    )
  })

  test('yarn workspaces info requested within specified directory', async () => {
    await processWorkspaces(processor, jest.fn(), '/working-directory')

    expect(mExec).toHaveBeenCalledWith(expect.any(String), {
      cwd: '/working-directory',
    })
  })

  test('processor invoked for each workspace', async () => {
    await processWorkspaces(processor, jest.fn())

    expect(processor).toHaveBeenCalledWith({
      name: 'package-a',
      location: '/path/to/a',
      pkg: {
        name: '/path/to/a',
      },
    })
    expect(processor).toHaveBeenCalledWith({
      name: 'package-b',
      location: '/path/to/b',
      pkg: {
        name: '/path/to/b',
      },
    })
  })

  test('package.json files read', async () => {
    await processWorkspaces(processor, jest.fn())

    expect(mReadFile).toHaveBeenCalledWith(`/path/to/a/package.json`)
    expect(mReadFile).toHaveBeenCalledWith(`/path/to/b/package.json`)
  })
})
