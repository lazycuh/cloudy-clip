import angular from 'angular-eslint';
import tsEslint from 'typescript-eslint';

import baseConfig from '../../eslint.config.js';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default tsEslint.config(
  {
    ignores: ['.terser-cache.json', '.mangled-selectors.json']
  },

  {
    files: ['**/*.ts', '**/scripts/**/*.js'],
    extends: [...baseConfig, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'lc',
          style: 'kebab-case'
        }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lc',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/no-host-metadata-property': 'off',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'import/no-unresolved': 'off'
    }
  },
  {
    files: ['src/**/*.html'],
    ignores: ['**/index.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/attributes-order': [
        'error',
        {
          alphabetical: true
        }
      ],
      '@angular-eslint/template/prefer-self-closing-tags': 'error'
    }
  }
);
