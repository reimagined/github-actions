import * as path from 'path'
import * as core from '@actions/core'
import isEmpty from 'lodash.isempty'
import { getGit } from '../../common/src/git'
import { parseBoolean } from '../../common/src/utils'
import { PushEvent } from '../../common/src/types'
import { getOctokit } from '@actions/github'
import { getDocker } from '@reimagined/github-actions-common/lib/src/docker'

export const main = async (): Promise<void> => {
  core.info('preparing to generate changelog')

  core.debug(`acquiring Git CLI`)
  const git = getGit(
    path.resolve('./'),
    core.getInput('ssh_private_key', { required: true }),
    core
  )

  const token = core.getInput('token', { required: true })

  core.debug(`parsing push event`)
  const event: PushEvent = JSON.parse(
    core.getInput(`push_event`, { required: true })
  )

  if (parseBoolean(core.getInput('prepare_git'))) {
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

    const branch = event.ref

    core.debug(`checking out branch: ${branch}`)
    git(`checkout ${branch}`)

    core.debug(`resetting branch to push commit: ${event.head_commit.id}`)
    git(`reset --hard ${event.head_commit.id}`)

    core.endGroup()
  }

  core.startGroup('starting generator')
  core.debug(`acquiring Docker`)
  const docker = getDocker(
    `githubchangeloggenerator/github-changelog-generator:${core.getInput(
      'generator_version'
    )}`
  )
  core.debug(`executing generator Docker image`)
  docker.runSync({
    stdio: 'inherit',
    mounts: [
      {
        host: process.cwd(),
        container: '/usr/local/src/your-app',
      },
    ],
    args: `--token=${token} --user=${event.repository.owner} --project=${
      event.repository.name
    } ${
      core.getInput('pre_release')
        ? `--unreleased --unreleased-only`
        : '--no-unreleased'
    }`,
  })
  core.endGroup()

  core.startGroup(`committing and pushing changes`)
  git(`add -u`)
  const commitMessage = core.getInput('commit_message')
  git(`commit -m "${commitMessage}"`)
  git(`push`)
}
