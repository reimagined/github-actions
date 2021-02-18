import { bumpDependencies } from '../src/utils'

describe('bumpDependencies', () => {
  test('bump [dependencies]', () => {
    const result = bumpDependencies(
      {
        dependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3',
      jest.fn()
    )

    expect(result).toEqual({
      dependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [devDependencies]', () => {
    const result = bumpDependencies(
      {
        devDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3',
      jest.fn()
    )

    expect(result).toEqual({
      devDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [peerDependencies]', () => {
    const result = bumpDependencies(
      {
        peerDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3',
      jest.fn()
    )

    expect(result).toEqual({
      peerDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })

  test('bump [optionalDependencies]', () => {
    const result = bumpDependencies(
      {
        optionalDependencies: {
          '@scope/tools': '0.0.0',
          '@scope/debug': '0.0.0',
          jest: '4.3.2',
        },
      },
      '@scope/.*$',
      '1.2.3',
      jest.fn()
    )

    expect(result).toEqual({
      optionalDependencies: {
        '@scope/tools': '1.2.3',
        '@scope/debug': '1.2.3',
        jest: '4.3.2',
      },
    })
  })
})
