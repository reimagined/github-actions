import clone from 'lodash.clonedeep'

type Dependencies = {
  [key: string]: string
}
type PackageDependencies = {
  dependencies?: Dependencies
  devDependencies?: Dependencies
  peerDependencies?: Dependencies
  optionalDependencies?: Dependencies
}

export const bumpDependencies = (
  pkg: PackageDependencies,
  pattern: string,
  version: string,
  debug: Function
): any => {
  const regExp = new RegExp('^' + pattern)

  const sections: Array<keyof PackageDependencies> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]
  const target = clone(pkg)

  sections.forEach((name) => {
    const section = target[name]
    if (section == null) {
      debug(`no [${section}] within package.json`)
    } else {
      Object.keys(section).forEach((lib) => {
        if (regExp.test(lib)) {
          debug(`${section}.${lib} (${section[lib]} -> ${version})`)
          section[lib] = version
        }
      })
    }
  })

  return target
}
