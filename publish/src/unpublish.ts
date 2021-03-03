import { readFileSync } from 'fs'
import * as core from '@actions/core'
import { execSync } from 'child_process'
import semver from 'semver'
import { getOctokit } from '@actions/github'

const isTrue = (value: string) =>
  value != null && ['yes', 'true', '1'].includes(value.toLowerCase())

const readString = (file: string): string => {
  return readFileSync(file).toString('utf-8')
}

const exec = (command: string) => {
  return execSync(command).toString('utf-8')
}

const githubClient = (token: string) => {
  const oktokit = getOctokit(token)

  const getPackageVersionId = async (packageName: string, version: string) => {
    const query = `
    query getVersions($packageName: String!, $version: String!) {
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
    const result: any = await oktokit.graphql(query, {
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
    return result.repository.packages.nodes[0].version.id
  }

  const unpublish = async (name: string, version: string) => {
    const packageVersionId = await getPackageVersionId(name, version)

    const mutation = `
  mutation deletePackageVersion($packageVersionId: String!) {
      deletePackageVersion(input: {packageVersionId: $packageVersionId}) {
          success
      }
  }`
    return await oktokit.graphql(mutation, {
      packageVersionId,
      headers: {
        Accept: 'application/vnd.github.package-deletes-preview+json',
      },
    })
  }
  return { unpublish }
}

const unpublishFromGithubRegistry = async (
  scopedPackageName: string,
  packageVersion: string
) => {
  const registryToken = core.getInput('token', { required: true })
  const frameworkScope = core.getInput('framework_scope')
  const packageName = scopedPackageName.replace(frameworkScope, '')
  const gh = githubClient(registryToken)
  return await gh.unpublish(packageName, packageVersion)
}

const unpublishPackage = async (
  packageName: string,
  packageVersion: string
) => {
  const isGithubRegistry = isTrue(core.getState('is_github_registry'))
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
