import baseConfig from '../../eslint.config.js';
import tsEslint from 'typescript-eslint';

export default tsEslint.config(
  {
    ignores: ['**/.wrangler']
  },

  {
    files: ['**/*.ts'],
    extends: [...baseConfig]
  }
);
