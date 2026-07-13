import { fileURLToPath } from 'node:url'
import antfu from '@antfu/eslint-config'

const tsconfigPath = fileURLToPath(new URL('./tsconfig.json', import.meta.url))

export default antfu(
  {
    ignores: [
      'test/**',
      'dist/**',
      'build/**',
      'prisma/seed/**',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.sql',
      'docs/**',
    ],

    formatters: {
      prettier: true,
    },
    typescript: {
      tsconfigPath,
    },
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: false,
    },
  },
  {
    // 全局规则（对所有文件生效）
    rules: {
      'no-console': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',

      // 禁用与 Prettier 冲突的样式规则
      'style/brace-style': 'off',
      'style/indent': 'off',
      'style/indent-binary-ops': 'off',
      'style/quotes': 'off',
      'style/semi': 'off',
      'style/comma-dangle': 'off',
      'style/object-curly-spacing': 'off',
      'style/array-bracket-spacing': 'off',
      'style/space-before-function-paren': 'off',
      'style/operator-linebreak': 'off',
      'style/arrow-parens': 'off', // 禁用箭头函数参数括号规则，交给 Prettier 处理

      // 确保花括号规则与 Prettier 一致
      curly: ['error', 'all'],
      'nonblock-statement-body-position': 'off',
    },
  },
  {
    // type-aware 规则只对 TypeScript 文件生效（.mjs/.js 等无类型信息）
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
    },
  },
  {
    // Markdown 代码块虽提取为虚拟 .ts 文件但没有类型信息，禁用 type-aware 规则
    files: ['**/*.md/**'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
)
