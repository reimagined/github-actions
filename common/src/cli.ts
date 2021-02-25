import isEmpty from 'lodash.isempty'
import * as os from 'os'
import { execSync, StdioOptions } from 'child_process'
import { CLI, CloudDeployment } from './types'

const execCLI = (
  appDir: string,
  args: string,
  stdio: StdioOptions = 'pipe'
): string => {
  const result = execSync(`yarn --silent resolve-cloud ${args}`, {
    cwd: appDir,
    stdio,
    env: {
      ...process.env,
    },
  })
  return result.toString()
}

export const getCLI = (appDir: string): CLI => execCLI.bind(null, appDir)

const toTable = (tableOutput: string) => {
  const rows = tableOutput
    .split(os.EOL)
    .filter((row) => row.trim() !== '')
    .map((row) =>
      row
        .split(' ')
        .map((val) => val.trim())
        .filter((val) => val)
    )
  const definitions = rows.shift()?.map((name) => name.toLowerCase())
  if (!definitions) {
    return []
  }
  return rows.map((row) =>
    definitions.reduce<{ [key: string]: string }>((entry, name, index) => {
      entry[name] = row[index]
      return entry
    }, {})
  )
}
const toObject = (tableOutput: string) => {
  const rows = tableOutput
    .split(os.EOL)
    .filter((row) => row.trim() !== '')
    .map((row) =>
      row
        .split(' ')
        .map((val) => val.trim())
        .filter((val) => val)
    )
  return rows.reduce<{ [key: string]: string }>((result, row) => {
    result[row[0]] = row[1]
    return result
  }, {})
}

export const describeApp = (
  appName: string,
  cli: CLI,
  core?: {
    error: (message: string) => void
    debug: (message: string) => void
  }
): CloudDeployment | null => {
  const deployment = toTable(cli('ls')).find((entry) => entry.name === appName)
  if (!deployment) {
    core?.error(
      `deployment with name (${appName}) not found with resolve-cloud ls`
    )
    return null
  }

  core?.debug(`deployment list arrived, retrieving description`)
  const description = toObject(cli(`describe ${deployment.id}`).toString())
  if (!description || isEmpty(description)) {
    core?.error(
      `deployment ${deployment.id} not found with resolve-cloud describe`
    )
    return null
  }

  const { id, version } = deployment
  const { applicationUrl } = description

  return {
    deploymentId: id,
    appUrl: applicationUrl,
    appRuntime: version,
    appName,
  }
}
