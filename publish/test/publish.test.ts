import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { mocked } from 'ts-jest/utils'
import { publish } from '../src/publish'
import { bumpDependencies } from '../src/utils'

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

test('invalid input: bad tag name', async () => {
  await expect(publish('2.0.0', '')).rejects.toBeInstanceOf(Error)
})

test('package.json read', async () => {
  await publish('2.0.0', 'latest')

  expect(mReadFile).toHaveBeenCalledWith('./package.json')
})

test('npm view requested', async () => {
  await publish('2.0.0', 'latest')

  expect(mExec).toHaveBeenCalledWith(`npm view mock-package@2.0.0 2>/dev/null`)
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

test('skip already published packages', async () => {
  mExec.mockReturnValueOnce(
    Buffer.from('mock-package@2.0.0 | ISC | deps: 1 | versions: 92')
  )

  await publish('2.0.0', 'latest')

  expect(mExec).toHaveBeenCalledTimes(1)
  expect(mBumpDependencies).not.toHaveBeenCalled()
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

  expect(mExec).toHaveBeenCalledWith(
    `npm publish --access=public --tag=latest --unsafe-perm`
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
