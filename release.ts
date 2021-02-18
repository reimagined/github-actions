import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { promisify } from 'util'
import { exec } from 'child_process'
import consola from 'consola'
import semver from 'semver'

const log = consola

const readFile = promisify(fs.readFile)

const execCommand = async (command: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log.warn(error.message)
        log.warn(stderr)
        log.warn(stdout)
        return reject(new Error(`${error.message}\n${stderr}\n${stdout}`))
      }
      return resolve(`${stdout}`.trim())
    })
  })

const release = async (): Promise<void> => {
  log.info('preparing release')

  const pkgContents = await readFile(path.resolve('./package.json'))
  const pkg = JSON.parse(pkgContents.toString())

  const pkgVersion = semver.parse(pkg.version)
  if (!pkgVersion) {
    throw Error(`cannot determine package version`)
  }

  const tagMatch = `v${pkgVersion.major}.${pkgVersion.minor}.*`

  const branch = execCommand(`git rev-parse --abbrev-ref HEAD`)
  log.info(`current branch ${branch}`)

  log.info(`fetching remote`)
  await execCommand(`git fetch --tags`)

  log.info(`determine latest release version by tags`)
  const tags = (await execCommand(`git tag --list ${tagMatch}`))
    .split(os.EOL)
    .filter((tag) => tag.length)
    .map((tag) => tag.slice(1))
    .sort(semver.compare)

  const latestVersion = semver.parse(
    tags.length
      ? tags[tags.length - 1]
      : `${pkgVersion.major}.${pkgVersion.minor}.0`
  )

  if (!latestVersion) {
    throw Error(`unable to determine latest version`)
  }

  const nextVersion = `${latestVersion.major}.${latestVersion.minor}.${
    latestVersion.patch + 1
  }`

  log.info(
    `determined latest version: ${latestVersion.version}, next version ${nextVersion}`
  )

  const releaseTag = `v${nextVersion}`
  const referenceTag = `v${latestVersion.major}`

  // eslint-disable-next-line no-console
  console.log(`::set-output name=RELEASE_TAG::${releaseTag}`)

  log.info(`stage build artifacts`)
  await execCommand(`yarn add-dist`)

  log.info(`committing build artifacts`)
  await execCommand(`git config user.name 'Resolve Bot'`)
  await execCommand(`git config user.email 'resolvejs@gmail.com'`)
  let skipRelease = true
  try {
    await execCommand(`git commit -nam "Build artifacts"`)
    await execCommand(`git tag ${releaseTag}`)
    await execCommand(`git tag -f ${referenceTag}`)
    await execCommand(`git push --atomic origin ${branch} ${releaseTag}`)
    await execCommand(`git push origin ${referenceTag} --force`)
    skipRelease = false
  } catch (error) {
    if (!error.message.includes('nothing to commit, working tree clean')) {
      throw error
    }
    log.info(`no changes detected`)
  }

  if (skipRelease) {
    log.info(`skipping release`)
    // eslint-disable-next-line no-console
    console.log(`::set-output name=SKIP_RELEASE::true`)
  } else {
    const commitSHA = await execCommand(`git rev-parse HEAD`)
    log.info(`current commit SHA: ${commitSHA}`)
    // eslint-disable-next-line no-console
    console.log(`::set-output name=SKIP_RELEASE::false`)
    // eslint-disable-next-line no-console
    console.log(`::set-output name=COMMIT_SHA::${commitSHA}`)
  }
}

release().catch((error) => {
  log.error(error)
  process.exit(1)
})
