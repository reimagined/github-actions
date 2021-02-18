import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { mocked } from 'ts-jest/utils'
import { publish } from '../src/publish'
import { bumpDependencies } from '../src/utils'

jest.mock('@actions/core')
jest.mock('fs')
jest.mock('child_process')
jest.mock('../src/utils')

const mReadFile = mocked(readFileSync)
const mWriteFile = mocked(writeFileSync)
const mExec = mocked(execSync)
const mBumpDependencies = mocked(bumpDependencies)

let pkg: object
let fileContents: string

beforeEach(() => {
  pkg = {
    name: 'mock-package',
    version: '1.0.0',
    private: false,
  }
  fileContents = JSON.stringify(pkg, null, 2)
  mReadFile.mockReturnValue(Buffer.from(fileContents))
  mExec.mockReturnValue(Buffer.from(''))
  mBumpDependencies.mockImplementation((pkg) => pkg)
})

test('invalid input: bad release version', async () => {
  await expect(publish('trash', 'release')).rejects.toBeInstanceOf(Error)
  await expect(publish('123', 'release')).rejects.toBeInstanceOf(Error)
  await expect(publish('', 'release')).rejects.toBeInstanceOf(Error)
})

test('package.json read', async () => {
  await publish('2.0.0', 'latest')

  expect(mReadFile).toHaveBeenCalledWith('./package.json')
})

test('npm view requested', async () => {
  await publish('2.0.0', 'latest')

  expect(mExec).toHaveBeenCalledWith(`npm view mock-package@2.0.0`, {
    stdio: 'pipe',
  })
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

  await publish('2.0.0', 'latest')

  expect(mExec).not.toHaveBeenCalled()
  expect(mBumpDependencies).not.toHaveBeenCalled()
})

test('skip already published packages if npm view info retrieved', async () => {
  mExec.mockReturnValueOnce(
    Buffer.from('mock-package@2.0.0 | ISC | deps: 1 | versions: 92')
  )

  await publish('2.0.0', 'latest')

  expect(mExec).toHaveBeenCalledTimes(1)
  expect(mBumpDependencies).not.toHaveBeenCalled()
})

test('throw error on unexpected npm view failure', async () => {
  mExec.mockImplementationOnce(() => {
    throw Error('failure')
  })

  await expect(publish('2.0.0', 'latest')).rejects.toEqual(Error('failure'))
})

test('bumping framework dependencies', async () => {
  await publish('2.0.0', 'latest')

  expect(mBumpDependencies).toHaveBeenCalledWith(
    { ...pkg, version: '2.0.0' },
    '@reimagined/.*$',
    '2.0.0'
  )
})

test('patched package.json written', async () => {
  await publish('2.0.0', 'latest')

  expect(mWriteFile).toHaveBeenCalledWith(
    './package.json',
    JSON.stringify({ ...pkg, version: '2.0.0' }, null, 2)
  )
})

test('npm publish invoked', async () => {
  await publish('2.0.0', 'latest')

  expect(
    mExec
  ).toHaveBeenCalledWith(
    `npm publish --access=public --unsafe-perm --tag=latest`,
    { stdio: 'pipe' }
  )
})

test('npm publish invoked (no tag)', async () => {
  await publish('2.0.0')

  expect(mExec).toHaveBeenCalledWith(
    `npm publish --access=public --unsafe-perm`,
    {
      stdio: 'pipe',
    }
  )
})

test('npm publish invoked if npm view returns 404', async () => {
  mExec.mockImplementationOnce(() => {
    throw Error('noise ERR! 404 Not Found noise')
  })

  await publish('2.0.0', 'latest')

  expect(mExec).toHaveBeenCalledWith(
    expect.stringContaining(`npm publish`),
    expect.any(Object)
  )
})

test('original package.json restored', async () => {
  await publish('2.0.0', 'latest')

  expect(mWriteFile).toHaveBeenCalledWith('./package.json', fileContents)
})

test('original package.json restored on error', async () => {
  mExec.mockImplementationOnce(() => Buffer.from(''))
  mExec.mockImplementationOnce(() => {
    throw Error('publish error simulation')
  })

  await expect(publish('2.0.0', 'latest')).rejects.toEqual(
    Error('publish error simulation')
  )

  expect(mWriteFile).toHaveBeenCalledWith('./package.json', fileContents)
})
