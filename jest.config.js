/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 90, branches: 90, functions: 90, statements: 90 },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
  ],
};
