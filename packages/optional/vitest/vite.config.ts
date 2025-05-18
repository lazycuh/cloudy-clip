import { coverageConfigDefaults, defineConfig } from 'vitest/config';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  test: {
    coverage: {
      clean: true,
      enabled: false,
      exclude: [
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
        'build/**',
        'scripts/**',
        'test/**',
        'vitest/**',
        ...coverageConfigDefaults.exclude
      ],
      extension: ['.ts'],
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reportOnFailure: true,
      reporter: process.env.CIRCLE_BRANCH ? ['lcov', 'json', 'json-summary'] : ['html', 'text', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    disableConsoleIntercept: true
  }
});
