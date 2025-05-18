import eslintConfigBase from '@lazycuh/eslint-config-base-with-vitest';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  ...eslintConfigBase.map(config => ({
    ...config,
    rules: {
      ...config.rules,
      'vitest/expect-expect': [
        'error',
        {
          assertFunctionNames: ['expect', 'assertCalledOnceWith']
        }
      ]
    },
    files: ['src/**/*.ts']
  })),

  {
    ignores: ['**/404.html']
  }
];
