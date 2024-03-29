import cps from 'child_process'
import path from 'path'
import globCb from 'glob'
import fs from 'fs'
import fse from 'fs-extra'
import { promisify } from 'util'
import partial from 'lodash.partial'
import { Logger, PathResolvers } from './types'

const readFile = promisify(fs.readFile)
const copy = promisify(fse.copy)
const emptyDir = promisify(fse.emptyDir)
const remove = promisify(fse.remove)
const exists = promisify(fs.exists)
const writeFile = promisify(fs.writeFile)
const glob = promisify(globCb)
const exec = promisify(cps.exec)

const tsConfigFileName = 'converter.tsconfig.json'

const bundleAssets = [
  'static/**/*',
  'data/.gitignore',
  'data-replica/.gitignore',
  '.babelrc',
  '.gitignore',
  '.prettierignore',
  'jest.config.js',
  'README.md',
  './**/*.vue',
  './**/*.css',
]

const redundantAssets = ['*tsconfig*', 'types.js']

const makeConfig = (
  resolve: PathResolvers,
  include: string[],
  exclude: string[],
  types: string[],
  module = 'ES2015'
) => ({
  include,
  exclude,
  compilerOptions: {
    outDir: resolve.out('./'),
    rootDir: resolve.source('./'),
    module,
    moduleResolution: 'node',
    esModuleInterop: false,
    sourceMap: false,
    jsx: 'react-native',
    allowJs: true,
    target: 'ES2018',
    lib: ['ES2018', 'dom'],
    types,
    noEmit: false,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
  },
})

const pipeSource = async (
  resolve: PathResolvers,
  assets: string[],
  processor: (source: string, target: string) => Promise<void>
): Promise<void> => {
  await assets.map(async (asset) => {
    const files = await glob(resolve.source(asset))
    await files.map(async (file) => {
      await processor(
        resolve.source(file),
        resolve.out(`.${file.substring(resolve.source('./').length)}`)
      )
    })
  })
}

const execTsc = async (directory: string, args: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    cps.exec(`tsc ${args}`, (error, stdout, stderr) => {
      if (error != null) {
        return reject(`${error}\n${stderr}\n${stdout}`)
      }
      return resolve(stdout)
    })
  })
}

const compile = async (resolve: PathResolvers, log: Logger) => {
  log.debug(`compiling sources and unit tests`)

  const tsconfigFile = resolve.out(tsConfigFileName)

  log.debug(`writing ${tsconfigFile}`)

  await writeFile(
    tsconfigFile,
    JSON.stringify(
      makeConfig(
        resolve,
        [resolve.source('./**/*')],
        [resolve.source('./test/e2e*'), resolve.source('./jest.config.ts')],
        ['node', 'jest']
      ),
      null,
      2
    )
  )

  await execTsc(resolve.source('./'), `--build ${tsconfigFile}`)
}

const compileE2E = async (resolve: PathResolvers, log: Logger) => {
  const e2eTests = await glob(resolve.source('./test/e2e*'))

  if (e2eTests.length > 0) {
    log.debug(`compiling E2E`)

    const tsconfigFile = resolve.out(tsConfigFileName)

    log.debug(`writing ${tsconfigFile}`)

    await writeFile(
      tsconfigFile,
      JSON.stringify(makeConfig(resolve, e2eTests, [], ['node']), null, 2)
    )

    await execTsc(resolve.source('./'), `--build ${tsconfigFile}`)
  } else {
    log.debug(`no E2E tests found, skipping compilation`)
  }
}

const compileJestConfig = async (resolve: PathResolvers, log: Logger) => {
  if (await exists(resolve.source('./jest.config.ts'))) {
    log.debug(`compiling jest.config.ts`)

    const tsconfigFile = resolve.out(tsConfigFileName)

    log.debug(`writing ${tsconfigFile}`)

    await writeFile(
      tsconfigFile,
      JSON.stringify(
        makeConfig(
          resolve,
          [resolve.source('./jest.config.ts')],
          [],
          ['node'],
          'commonjs'
        ),
        null,
        2
      )
    )

    await execTsc(resolve.source('./'), `--build ${tsconfigFile}`)
  } else {
    log.debug(`no E2E tests found, skipping compilation`)
  }
}

const copyAssets = async (resolve: PathResolvers, log: Logger) => {
  log.debug(`copying assets:`)
  await pipeSource(resolve, bundleAssets, async (source, target) => {
    log.debug(`${source} -> ${target}`)
    await copy(source, target)
  })
}

const strip = async (resolve: PathResolvers, log: Logger) => {
  log.debug(`stripping JS example`)

  await redundantAssets.map(async (asset) => {
    const files = await glob(resolve.out(asset))
    await files.map(async (file) => {
      log.debug(`! ${file}`)
      await remove(file)
    })
  })
}

const patchJsonFile = (
  fileName: string,
  transform: (sourceJson: object) => object
) => async (resolve: PathResolvers, log: Logger) => {
  log.debug(`patching ${fileName}`)
  const fileContents = (await readFile(resolve.source(fileName))).toString()
  const sourceJson = JSON.parse(fileContents)

  const resultingJson = transform(sourceJson)

  await writeFile(resolve.out(fileName), JSON.stringify(resultingJson, null, 2))
}

const patchBabelrc = patchJsonFile('.babelrc', (sourceJson: any) => ({
  ...sourceJson,
  presets: sourceJson.presets.filter((entry) => !entry.includes('typescript')),
}))

const patchPackageJson = patchJsonFile('package.json', (sourceJson: any) => {
  const nonTypescriptEntries = (key) =>
    key !== 'typescript' && key !== 'ts-node' && !key.startsWith('@types/')

  const keepNonTypescriptEntries = (entries) => {
    return Object.keys(entries)
      .filter(nonTypescriptEntries)
      .reduce((obj, key) => ({ ...obj, [key]: entries[key] }), {})
  }

  const patchedScripts = Object.keys(sourceJson.scripts).reduce(
    (obj, key) => ({
      ...obj,
      [key]: sourceJson.scripts[key]
        .replace('tsc && babel-node --extensions=.ts,.tsx', 'babel-node')
        .replace('ts-node', 'babel-node')
        .replace('run.ts', 'run.js'),
    }),
    {}
  )

  return {
    ...sourceJson,
    name: sourceJson.name.replace('-ts', '-js'),
    scripts: patchedScripts,
    dependencies: keepNonTypescriptEntries(sourceJson.dependencies),
    devDependencies: keepNonTypescriptEntries(sourceJson.devDependencies),
  }
})

const patchConfigs = async (resolve: PathResolvers, log: Logger) => {
  const filenamePatterns = ['config.*.js', 'run.js', 'jest.config.js']

  const replaceFileExtensions = (input) =>
    input
      .replace(/(\.tsx?',\n)/g, ".js',\n")
      .replace(/(\.tsx?'],\n)/g, ".js'],\n")
      .replace(/(\.tsx?'] },\n)/g, ".js'] },\n")

  await Promise.all(
    filenamePatterns.map(async (pattern) => {
      const files = await glob(resolve.out(pattern))
      return await Promise.all(
        files.map(async (file) => {
          log.debug(`patching ${file}`)
          const fileContents = replaceFileExtensions(
            (await readFile(file)).toString()
          )

          return writeFile(file, fileContents)
        })
      )
    })
  )
  log.debug(`configs patching done`)
}

const patchAdjustWebpack = async (resolve: PathResolvers, log: Logger) => {
  const fileName = 'config.adjust-webpack.js'
  log.debug(`patching ${fileName}`)

  const deletionPatterns = [
    /enableTypescript\(webpackConfig\)/g,
    /(\/\/ enable-ts)(.|\n)+(\/\/ enable-ts)/g,
  ]

  const fileContents = (await readFile(resolve.out(fileName))).toString()
  const patchedContents = deletionPatterns.reduce(
    (content, pattern) => content.replace(pattern, ''),
    fileContents
  )
  await writeFile(resolve.out(fileName), patchedContents)
}

const prettify = async (resolve: PathResolvers, log: Logger) => {
  log.debug(`running Prettier`)
  await exec('yarn prettier --write "**/**.{js,jsx,json,babelrc}"', {
    cwd: resolve.out(''),
  })
}

export const converter = async (
  sourceDir: string,
  outDir: string,
  log: Logger
): Promise<void> => {
  log.debug(`TS to JS example converter starting`)
  log.debug(`sourceDir: ${sourceDir}`)
  log.debug(`outDir: ${outDir}`)

  const resolve = {
    source: partial(path.resolve, sourceDir),
    out: partial(path.resolve, outDir),
  }

  log.debug(`touching ${outDir}`)

  await emptyDir(outDir)

  await compile(resolve, log)
  await compileE2E(resolve, log)
  await compileJestConfig(resolve, log)
  await copyAssets(resolve, log)
  await patchAdjustWebpack(resolve, log)
  await patchConfigs(resolve, log)
  await patchBabelrc(resolve, log)
  await patchPackageJson(resolve, log)
  await strip(resolve, log)
  await prettify(resolve, log)
}
