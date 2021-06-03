import cps from 'child_process'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import partial from 'lodash.partial'
import { Logger, PathResolver } from './types'

const truncateFile = promisify(fs.truncate)
const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)
const mkdir = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)
const exec = promisify(cps.exec)

const tsConfigFileName = 'converter.tsconfig.json'
const makeConfig = (resolveSource: PathResolver, resolveOut: PathResolver) => ({
  include: [resolveSource('./**/*')],
  exclude: [resolveSource('./test/e2e')],
  compilerOptions: {
    outDir: resolveOut('./'),
    rootDir: resolveSource('./'),
    module: 'ES2015',
    moduleResolution: 'node',
    esModuleInterop: false,
    sourceMap: false,
    jsx: 'react',
    allowJs: true,
    target: 'ES2018',
    lib: ['ES2018', 'dom'],
    types: ['node', 'react', 'jest'],
    noEmit: false,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
  },
})

const execTsc = async (
  directory: string,
  args: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> => {
  return await new Promise((resolve, reject) => {
    cps.exec(`tsc ${args}`, (error, stdout, stderr) => {
      if (error != null) {
        return reject(`${error}\n${stderr}\n${stdout}`)
      }
      return resolve(stdout)
    })
  })

  /*
  const { stdout, stderr } = await exec(`tsc ${args}`, {
    env,
  })
  if (result != null) {
    return result.toString()
  }
  return ''
   */
}

const runTSC = async (
  resolveSource: PathResolver,
  resolveOut: PathResolver,
  log: Logger
) => {
  const tsconfigFile = resolveOut(tsConfigFileName)

  log.debug(`writing ${tsconfigFile}`)

  await writeFile(
    tsconfigFile,
    JSON.stringify(makeConfig(resolveSource, resolveOut), null, 2)
  )

  log.debug(`executing TSC`)

  await execTsc(
    resolveSource('./'),
    `--build ${tsconfigFile}`
  )
}

export const converter = async (
  sourceDir: string,
  outDir: string,
  log: Logger
): Promise<void> => {
  log.debug(`TS to JS example converter starting`)
  log.debug(`sourceDir: ${sourceDir}`)
  log.debug(`outDir: ${outDir}`)

  const resolveSource = partial(path.resolve, sourceDir)
  const resolveOut = partial(path.resolve, outDir)

  log.debug(`touching ${outDir}`)

  if (!(await exists(outDir))) {
    log.debug(`creating ${outDir}`)
    await mkdir(outDir)
  }

  log.debug(`processing project with TSC`)

  await runTSC(resolveSource, resolveOut, log)
}
