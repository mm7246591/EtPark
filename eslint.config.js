import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import tailwind from 'eslint-plugin-tailwindcss';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

export default defineConfig([
  globalIgnores([
    'dist/',
    'coverage/',
    'public/',
    '.agents/',
    '.claude/',
    '**/*.d.ts',
    '**/*.d.mts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs['flat/recommended'],
  // ponytail: 3.x 是支援 Tailwind 3 的最後一版；classnames-order 遇到含 ${} 的樣板字串 class 會因 ESLint 10 移除 context.getSourceCode() 而報錯，升 Tailwind 4 時一併換 4.x。
  tailwind.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createNodeResolver({
          extensions: ['.ts', '.js', '.mjs', '.vue', '.json'],
          alias: { '@': [fileURLToPath(new URL('src', import.meta.url))] },
        }),
      ],
      tailwindcss: {
        // 3.18.1 起需絕對路徑才找得到 tailwindcss。
        config: fileURLToPath(new URL('tailwind.config.js', import.meta.url)),
        cssFiles: [
          'src/assets/theme/variables.scss',
          'src/assets/styles/main.scss',
        ],
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-irregular-whitespace': ['error', { skipTemplates: true }],
      // 函式一律使用箭頭函式（AGENTS.md）。
      'func-style': ['error', 'expression'],
      // 沿用原 airbnb-base 常用規則。
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-param-reassign': ['error', { props: true }],
      'no-await-in-loop': 'error',
      'no-nested-ternary': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'import-x/first': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', ts: 'never', vue: 'always' },
      ],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            'src/__tests__/**/*.ts',
            'server/**/*.test.mjs',
            '*.config.*',
          ],
        },
      ],
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': 'error',
      'tailwindcss/no-contradicting-classname': 'warn',
      // 使用明確 px 數值，保留 w-[32px] h-[32px] 等寫法。
      'tailwindcss/enforces-shorthand': 'off',
      'tailwindcss/no-unnecessary-arbitrary-value': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: { 'no-undef': 'off' },
  },
  prettierRecommended,
]);
