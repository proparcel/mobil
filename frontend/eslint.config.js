const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      'android/*',
      'ios/*',
      '.metro-cache/*',
      'build/*',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
