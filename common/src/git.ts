import * as path from 'path'
import partial from 'lodash.partial'
import { nanoid } from 'nanoid'
import { writeFileSync, existsSync } from 'fs'
import { notEmpty } from './utils'
import { execSync, StdioOptions } from 'child_process'
import { Git } from './types'

const execGit = (
  directory: string,
  env: NodeJS.ProcessEnv,
  args: string,
  stdio: StdioOptions = 'pipe'
): string => {
  const result = execSync(`git ${args}`, {
    cwd: directory,
    stdio,
    env,
  })
  if (result != null) {
    return result.toString()
  }
  return ''
}

// FIXME: add unit test
export const getGit = (
  sshKeyBase64: string,
  directory: string,
  core?: {
    debug: (message: string) => void
    startGroup: (name: string) => void
    endGroup: () => void
  }
): Git => {
  const debug = (message: string) => core?.debug(`getGIT: ${message}`)

  core?.startGroup('getGIT')

  if (!notEmpty(sshKeyBase64)) {
    throw Error(`empty SSH key content`)
  }

  const sshKey = Buffer.from(sshKeyBase64, 'base64').toString()
  const keyFile = path.resolve('./', `ssh-key-${nanoid(5)}`)
  debug(`targetFile=${keyFile}`)

  if (existsSync(keyFile)) {
    throw Error(`SSH key target file ${keyFile} already exists`)
  }

  debug(`writing SSH key to disk`)
  writeFileSync(keyFile, sshKey, {
    encoding: 'ascii',
    mode: 0o600,
  })

  debug(`checking key passphrase encryption`)
  let checkProtection = ''
  try {
    checkProtection = execSync(`ssh-keygen -y -P "" -f ${keyFile}`, {
      stdio: 'pipe',
    }).toString()
  } catch (error) {
    throw Error(`cannot use SSH key: ${error.message}`)
  }

  if (
    checkProtection.includes(
      'incorrect passphrase supplied to decrypt private key'
    )
  ) {
    throw Error(`SSH key seem to be password protected and cannot be used`)
  }

  const gitEnv = {
    ...process.env,
    SSH_AUTH_SOCK: '/tmp/ssh_agent.sock',
  }

  debug(`launching SSH agent`)
  try {
    execSync(`ssh-agent -a $SSH_AUTH_SOCK > /dev/null`, {
      env: gitEnv,
    })
  } catch (error) {
    throw Error(`unable to start SSH agent: ${error.message}`)
  }

  debug(`adding key to SSH agent (system dependent)`)
  let keyInstall = ''
  try {
    keyInstall = execSync(`ssh-add ${keyFile}`, {
      stdio: 'pipe',
      env: gitEnv,
    }).toString()
  } catch (error) {
    throw Error(`unable to add SSH key: ${error.message}`)
  }

  if (notEmpty(keyInstall) && !keyInstall.includes('Identity added:')) {
    throw Error(`unexpected ssh-add output: ${keyInstall}`)
  }

  debug(`SSH key added: ${keyFile}`)
  core?.endGroup()

  return partial(execGit, directory, gitEnv)
}
