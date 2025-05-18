import baseConfig from '../../eslint.config.js';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  ...baseConfig,
  {
    ignores: ['src/index.d.ts']
  }
];
