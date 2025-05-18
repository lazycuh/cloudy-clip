import baseConfig from '../../eslint.config.js';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default baseConfig.map(config => ({
  ...config,
  files: ['**/*.ts']
}));
