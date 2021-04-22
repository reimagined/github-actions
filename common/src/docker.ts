import { execSync } from 'child_process'
import partial from 'lodash.partial'
import { Docker, DockerRunOptions } from './types'

const runImage = (image: string, options?: DockerRunOptions): string => {
  const args: string[] = ['--rm']

  args.push(
    options && options.mounts && options.mounts.length > 0
      ? options.mounts
          .map((mount) => `-v ${mount.host}:${mount.container}`)
          .join(' ')
      : ''
  )

  args.push(...[image, options?.args ?? ''])

  const result = execSync(
    `docker run ${args.filter((arg) => arg.length > 0).join(' ')}`,
    {
      stdio: options?.stdio ?? 'pipe',
    }
  )
  return result.toString()
}

export const getDocker = (image: string): Docker => {
  return {
    runSync: partial(runImage, image),
  }
}
