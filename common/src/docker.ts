import { spawn } from 'child_process'
import partial from 'lodash.partial'
import { Docker, DockerRunOptions } from './types'

const runImage = async (
  image: string,
  options?: DockerRunOptions
): Promise<string> => {
  const args: string[] = ['run', '--rm']

  args.push(
    options && options.mounts && options.mounts.length > 0
      ? options.mounts
          .map((mount) => `-v ${mount.host}:${mount.container}`)
          .join(' ')
      : ''
  )

  args.push(...[image, options?.args ?? ''])

  return await new Promise((resolve, reject) => {
    const proc = spawn(
      `docker`,
      args.filter((arg) => arg.length > 0),
      {
        shell: true,
        stdio: options?.stdio ?? 'inherit',
      }
    )
    let result
    proc.on('data', (data) => {
      result += data.toString()
    })
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        reject(Error(`Process exit with code ${code}`))
      }
      return resolve(result)
    })
  })
}

export const getDocker = (image: string): Docker => {
  return {
    run: partial(runImage, image),
  }
}
