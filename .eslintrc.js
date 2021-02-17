const typescriptEslintRecommended = require('@typescript-eslint/eslint-plugin')
  .configs.recommended

module.exports = {
  env: {
    node: true,
    jest: true,
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  extends: ['plugin:prettier/recommended'],
  plugins: ['import'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      plugins: ['@typescript-eslint'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:import/typescript'],
      rules: Object.assign({}, typescriptEslintRecommended.rules, {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/member-delimiter-style': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'no-redeclare': 'off',
      }),
    },
  ],
  rules: {
    'react-hooks/exhaustive-deps': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'func-names': 'off',
    'no-underscore-dangle': 'off',
    'import/no-unresolved': 'off',
    'comma-dangle': 'off',
    'no-plusplus': 'off',
    'jsx-a11y/href-no-hash': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'no-param-reassign': ['error', { props: false }],
    'new-cap': ['error', { capIsNew: false }],
    'no-lone-block': 'off',
    'no-lone-blocks': 'off',
    'no-mixed-operators': 'off',
    'object-curly-spacing': ['error', 'always'],
    'no-unused-vars': ['error', { args: 'after-used' }],
    'max-len': 'off',
    'no-control-regex': 'off',
    'eol-last': ['error', 'always'],
    'no-console': ['error'],
  },
}
