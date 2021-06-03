import minimist from 'minimist'
import path from 'path'
import consola from 'consola'
import { converter } from './converter'

const args = minimist(process.argv.slice(2))

const sourceDir = args._[0] || process.cwd()
const outDir = args['out-dir'] || './conv-js'

converter(
  path.resolve(process.cwd(), sourceDir),
  path.resolve(process.cwd(), outDir),
  consola
)
  .then(void 0)
  .catch((error) => {
    consola.error(error)
    process.exit(1)
  })
