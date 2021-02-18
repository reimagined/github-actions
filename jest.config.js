module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  rootDir: process.cwd(),
  testMatch: ['**/test/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: ['src/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  roots: ['<rootDir>/src', '<rootDir>/test'],
}
