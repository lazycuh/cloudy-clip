import angular from '@analogjs/vite-plugin-angular';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

// eslint-disable-next-line import/no-default-export
export default defineConfig(({ mode }) => ({
  define: {
    __IS_TEST__: JSON.stringify(true),
    __ORCHESTRATOR_URL__: JSON.stringify('http://localhost:4300/api'),
    __ORIGIN__: JSON.stringify('http://localhost:4300'),
    __STRIPE_API_KEY__: JSON.stringify(
      'pk_test_51Q254AIWw5KeSeJEw8IoA3Cj3PgmRfCInvx5gPkF0XNtuAo6mPC1q9dOIy6w9ZQNowFIFareXRTatHt4xE0acqzL00t9ZcqWW1'
    ),
    'import.meta.vitest': JSON.stringify(mode !== 'production')
  },
  plugins: [angular(), viteTsConfigPaths()],
  test: {
    coverage: {
      clean: true,
      enabled: false,
      exclude: [
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/app.config.server.ts',
        '**/app.config.ts',
        '**/app.routes.ts',
        '**/backdrop.component.ts',
        '**/global-state.ts',
        '**/indeterminate-progress.component.ts',
        '**/index.ts',
        '**/payment-method.ts',
        '**/payment-reason.ts',
        '**/payment-status.ts',
        '**/payment.ts',
        '**/refund-policy.component.ts',
        '**/turnstile-form-field.component.ts',
        '**/upcoming-payment.ts',
        'build/**',
        'scripts/**',
        'test/**',
        'vitest/**',
        ...coverageConfigDefaults.exclude
      ],
      extension: ['.ts'],
      include: ['src/app/**/*.ts'],
      provider: 'istanbul',
      reportOnFailure: true,
      reporter: process.env.CIRCLE_BRANCH ? ['lcov', 'json', 'json-summary'] : ['html', 'text', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        branches: 89.66,
        functions: 95.17,
        lines: 96.65,
        statements: 96.58
      }
    },
    environment: 'happy-dom',
    exclude: ['**/*.js', '**/*.mjs', '**/*.mts'],
    globals: true,
    include: ['src/app/**/*.{test,spec}.ts'],
    setupFiles: ['./vitest/setup.ts']
  }
}));
