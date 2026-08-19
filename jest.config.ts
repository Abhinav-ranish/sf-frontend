import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

// Packages that ship ESM only and therefore must go through the SWC transform
// instead of being skipped along with the rest of node_modules. The `next/*`
// and `geist` entries preserve what next/jest transforms by default.
const TRANSFORMED_MODULES = [
  'geist',
  'next/dist/client',
  'next/dist/shared/lib',
  'next/src/client',
  'next/src/shared/lib',
  'msw',
  '@mswjs',
  'rettime',
  'until-async',
  'outvariant',
  'strict-event-emitter',
  'is-node-process',
  'headers-polyfill',
  '@open-draft',
  '@bundled-es-modules',
  'tough-cookie',
  'graphql',
  'path-to-regexp',
]

const config: Config = {
  coverageProvider: 'v8',
  // jsdom, but with Node's fetch/Request/Response/stream globals left intact so
  // MSW's Node interceptors work. See https://github.com/mswjs/jest-fixed-jsdom
  testEnvironment: 'jest-fixed-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // `server-only` throws unless the bundler resolves the react-server condition,
    // which Jest does not; stub it so server modules can be unit-tested.
    '^server-only$': '<rootDir>/src/__tests__/mocks/server-only.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    // Route files (pages, layouts, boundaries) are exercised by Playwright.
    '!src/app/**',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
      branches: 60,
    },
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/*.spec.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],
}

// next/jest *appends* its own transformIgnorePatterns, and the list is an OR — so
// its broad "/node_modules/(?!...)" entry would re-ignore the ESM packages above.
// Replace the list on the resolved config instead of adding to it.
export default async function jestConfig(): Promise<Config> {
  const resolved = await createJestConfig(config)()
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(?:\\.pnpm/)?(${TRANSFORMED_MODULES.join('|')})/)`,
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  }
}
