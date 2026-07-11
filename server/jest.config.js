module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Test file patterns (support both .ts and .js)
  testMatch: [
    '**/__tests__/**/*.(test|spec).ts',
    '**/__tests__/**/*.(test|spec).js',
    '**/?(*.)+(spec|test).ts',
  ],

  // Coverage settings
  collectCoverageFrom: [
    'utils/**/*.{ts,js}',
    'middleware/**/*.{ts,js}',
    'controllers/**/*.{ts,js}',
    '!**/node_modules/**',
    '!**/logs/**',
    '!**/*.d.ts',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Timeout for tests
  testTimeout: 10000,

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform settings for ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Allow JS imports in tests
          allowJs: true,
          // Relax strictness for tests
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },

  // Root directory
  roots: ['<rootDir>'],
};
