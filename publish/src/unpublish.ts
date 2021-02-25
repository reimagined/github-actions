import { readFileSync } from 'fs'
import * as core from '@actions/core'
import { execSync } from 'child_process'
import semver from 'semver'
import { getOctokit } from '@actions/github'
import { parseBoolean } from '../../common/src/utils'

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

const exec = (command: string) => {
  return execSync(command).toString('utf-8')
}

const githubClient = (token: string) => {
  const github = getOctokit(token)

  const getPackageVersionId = async (packageName: string, version: string) => {
    const query = `
    query getVersions($package: String!, $version: String!) {
      repository(owner:\"reimagined\",name:\"resolve\") {
        packages(first:1, names: [$packageName]) {
          nodes {
            name,
            id,
            version(version:$version) {
              id,
              version
            }
          }
        }
      }
    }`
    const result: any = await github.graphql(query, {
      packageName,
      version,
      headers: {
        Accept: 'application/vnd.github.packages-preview+json',
      },
    })
    if (result.repository.packages.nodes.length === 0) {
      throw Error(`Package is not found in the registry: ${packageName}`)
    }
    if (!result.repository.packages.nodes[0].version) {
      throw Error(`Package version is not found in the registry: ${version}`)
    }
    const packageVersionId = result.repository.packages.nodes[0].version.id
    return packageVersionId
  }

  const unpublish = async (name: string, version: string) => {
    const packageVersionId = await getPackageVersionId(name, version)

    const mutation = `
  mutation deletePackageVersion($packageVersionId: String!) {
      deletePackageVersion(input: {packageVersionId: $packageVersionId}) {
          success
      }
  }`
    return await github.graphql(mutation, {
      packageVersionId,
      headers: {
        Accept: 'application/vnd.github.package-deletes-preview+json',
      },
    })
  }
  return { unpublish }
}

const unpublishFromGithubRegistry = async (
  packageName: string,
  packageVersion: string
) => {
  const registryToken = core.getInput('token', { required: true })
  await githubClient(registryToken).unpublish(packageName, packageVersion)
}

const unpublishPackage = async (
  packageName: string,
  packageVersion: string
) => {
  const isGithubRegistry = parseBoolean(core.getState('is_github_registry'))
  isGithubRegistry
    ? await unpublishFromGithubRegistry(packageName, packageVersion)
    : exec(`npm unpublish --force ${packageName}@${packageVersion}`)
}

export const unpublish = async (
  version: string,
  packageLocation = '.'
): Promise<void> => {
  const publishedVersion = semver.parse(version)
  if (!publishedVersion) {
    throw Error(`invalid publish version: ${version}`)
  }

  const pkg = JSON.parse(readString(`${packageLocation}/package.json`))

  const { name, private: restricted } = pkg

  if (restricted) {
    return
  }

  try {
    await unpublishPackage(name, publishedVersion.version)
  } catch (error) {}
}
