import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      'test/**',
      'dist/**',
      'build/**',
      'prisma/seed/**',
    ],

    formatters: {
      prettier: true,
    },
    typescript: {
      tsconfigPath: 'tsconfig.json',
    },
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: false,
    },
  },
  {
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',

      // 禁用与 Prettier 冲突的样式规则
      'style/brace-style': 'off',
      'style/indent': 'off',
      'style/quotes': 'off',
      'style/semi': 'off',
      'style/comma-dangle': 'off',
      'style/object-curly-spacing': 'off',
      'style/array-bracket-spacing': 'off',
      'style/space-before-function-paren': 'off',
      'style/operator-linebreak': 'off',
      'style/arrow-parens': 'off', // 禁用箭头函数参数括号规则，交给 Prettier 处理

      // 确保花括号规则与 Prettier 一致
      "curly": ['error', 'all'],
      'nonblock-statement-body-position': 'off',
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}', 'libs/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@libs/app-content',
              message:
                'Use domain public API from @libs/app-content/<domain> instead of the root barrel.',
            },
            {
              name: '@libs/content',
              message:
                'Use domain public API from @libs/content/<domain> instead of the root barrel.',
            },
            {
              name: '@libs/forum',
              message:
                'Use domain public API from @libs/forum/<domain> instead of the root barrel.',
            },
            {
              name: '@libs/growth',
              message:
                'Use domain public API from @libs/growth/<domain> instead of the root barrel.',
            },
            {
              name: '@libs/interaction',
              message:
                'Use domain public API from @libs/interaction/<domain> instead of the root barrel.',
            },
            {
              name: '@libs/message',
              message:
                'Use domain public API from @libs/message/<domain> instead of the root barrel.',
            },
          ],
          patterns: [
            {
              group: [
                '@libs/app-content/*/*',
                '@libs/content/*/*',
                '@libs/forum/*/*',
                '@libs/growth/*/*',
                '@libs/interaction/*/*',
                '@libs/message/*/*',
              ],
              message:
                'Use second-level public API @libs/<lib>/<domain> instead of file deep imports.',
            },
            {
              group: [
                '@libs/app-config/*',
                '@libs/config/*',
                '@libs/dictionary/*',
                '@libs/sensitive-word/*',
                '@libs/system-config/*',
              ],
              message:
                'Use public API from @libs/<lib> instead of file deep imports.',
            },
          ],
        },
      ],
    },
  },
)
