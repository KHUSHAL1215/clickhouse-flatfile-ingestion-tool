// eslint.config.js
export default [
    {
      files: ['**/*.js'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
          process: 'readonly',
          __dirname: 'readonly',
          module: 'readonly',
        },
      },
      rules: {
        // add your custom rules if needed
      },
    },
  ];
  