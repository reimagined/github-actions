module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  rootDir: process.cwd(),
  testMatch: ['**/test/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: -10,
    },
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  roots: ['<rootDir>/src', '<rootDir>/test'],
}
