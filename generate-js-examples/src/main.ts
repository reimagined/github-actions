import * as path from 'path'
import * as core from '@actions/core'
import globCb from 'glob'
import isEmpty from 'lodash.isempty'
import { getOctokit } from '@actions/github'
import { branchFromRef } from '../../common/src/utils'
import { getGit } from '../../common/src/git'
import { PushEvent } from '../../common/src/types'
import { ActionConverterEntry } from './types'
import { promisify } from 'util'
import { converter } from './converter'

const glob = promisify(globCb)

export const main = async (): Promise<void> => {
  core.debug(`parsing push event`)
  const event: PushEvent = JSON.parse(
    core.getInput(`push_event`, { required: true })
  )

  const entries = JSON.parse(
    core.getInput('entries', { required: true })
  ) as ActionConverterEntry[]

  if (entries.length === 0) {
    core.setFailed(`no entries to process`)
    return
  }

  const commitMessage = core.getInput('commit_message')
  if (event.head_commit.message === commitMessage) {
    core.warning(
      `Skipping own commit because of message "${commitMessage}". There will be more efficient to add workflow condition!`
    )
    return
  }

  core.info('preparing to generate JS examples')

  core.debug(`acquiring Git CLI`)
  const git = getGit(path.resolve('./'), core.getInput('ssh_private_key'), core)
  const token = core.getInput('token', { required: true })

  core.startGroup('configuring git')
  core.debug(`requesting PAT user info`)
  const octokit = getOctokit(token)
  const {
    data: { login: name, email },
  } = await octokit.users.getAuthenticated()
  if (isEmpty(email)) {
    throw Error(
      `cannot retrieve user ${name} email with provided PAT, check GitHub account email privacy settings`
    )
  }

  core.info(`user.email: ${email}`)
  git(`config --global user.email ${email}`)

  core.info(`user.name: ${name}`)
  git(`config --global user.name ${name}`)
  core.endGroup()

  core.startGroup('preparing repository')
  core.debug(`cloning repo ${event.repository.ssh_url}`)
  git(`clone ${event.repository.ssh_url} ./`)

  core.debug(`determining branch from ref: ${event.ref}`)
  const branch = branchFromRef(event.ref)

  core.debug(`checking out branch: ${branch}`)
  git(`checkout ${branch}`)

  core.debug(`resetting branch to push commit: ${event.head_commit.id}`)
  git(`reset --hard ${event.head_commit.id}`)

  core.endGroup()

  core.startGroup('generate JS projects')
  core.debug(`gathering source directories`)

  const refinedEntries = (
    await Promise.all(
      entries.map(async (entry) => {
        const sources = await glob(entry.source)
        return sources.map((source) => ({
          source: path.resolve(process.cwd(), source),
          out: path.resolve(process.cwd(), entry.out),
        }))
      })
    )
  ).flat(1)

  core.debug(`gathered ${refinedEntries.length} entries to process`)

  await Promise.all(
    refinedEntries.map(async ({ source, out }) => {
      await converter(source, out, core)
    })
  )

  core.endGroup()

  core.startGroup(`Committing and pushing changes`)
  try {
    git(`add -u`)
    git(`commit -m "${commitMessage}"`)
    git(`push`)
  } catch (e) {
    core.error(e)
  } finally {
    core.endGroup()
  }
}
