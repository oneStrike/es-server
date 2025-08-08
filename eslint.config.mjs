import antfu from '@antfu/eslint-config'

export default antfu(
  {
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
)
