import * as path from 'path'
import { nanoid } from 'nanoid'
import { writeFileSync, existsSync } from 'fs'
import { notEmpty } from './utils'
import { execSync } from 'child_process'

// FIXME: add unit test
export const registerPrivateKey = (
  content: string,
  file?: string,
  core?: {
    debug: (message: string) => void
  }
): string => {
  if (!notEmpty(content)) {
    throw Error(`empty SSH key content`)
  }

  const debug = (message: string) =>
    core?.debug(`registerPrivateKey: ${message}`)

  const targetFile = notEmpty(file)
    ? file
    : path.resolve('./', `ssh-key-${nanoid(5)}`)
  debug(`targetFile=${targetFile}`)

  if (existsSync(targetFile)) {
    throw Error(`SSH key target file ${targetFile} already exists`)
  }

  debug(`writing SSH key to disk`)
  writeFileSync(targetFile, content, {
    encoding: 'ascii',
    mode: 0o600,
  })

  debug(`checking key passphrase encryption`)

  let checkProtection = ''
  try {
    checkProtection = execSync(`ssh-keygen -y -P "" -f ${targetFile}`, {
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

  debug(`adding key to SSH agent (system dependent)`)
  let keyInstall = ''
  try {
    keyInstall = execSync(`ssh-add ${targetFile}`, { stdio: 'pipe' }).toString()
  } catch (error) {
    throw Error(`unable to add SSH key: ${error.message}`)
  }

  if (notEmpty(keyInstall) && !keyInstall.includes('Identity added:')) {
    throw Error(`unexpected ssh-add output: ${keyInstall}`)
  }

  debug(`SSH key added: ${targetFile}`)
  return targetFile
}
