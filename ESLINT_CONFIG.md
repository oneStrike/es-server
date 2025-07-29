# ESLint 配置说明

## 📋 配置概述

本项目的 ESLint 配置专门为 NestJS 项目优化，提供了严格但实用的代码质量检查。

## 🎯 主要特性

### 1. TypeScript 支持

- 完整的 TypeScript 语法支持
- 类型检查和推断优化
- 装饰器语法支持（NestJS 必需）

### 2. NestJS 最佳实践

- 依赖注入模式支持
- 控制器和服务类规范
- 模块化架构检查

### 3. 代码质量规则

- **严格模式**: 禁用 `var`，强制使用 `const`/`let`
- **类型安全**: 限制 `any` 类型使用，推荐明确类型
- **异步处理**: 检查 Promise 和 async/await 使用
- **导入管理**: 防止重复导入，优化导入顺序

### 4. 代码风格统一

- 与 Prettier 集成，避免冲突
- 统一的缩进、引号、分号规则
- 一致的命名约定

## 🔧 规则分级

### Error (错误)

- 语法错误和类型错误
- 安全问题
- 明显的逻辑错误

### Warning (警告)

- 代码质量建议
- 性能优化建议
- 最佳实践提醒

## 📁 特殊文件处理

### 测试文件 (`**/*.spec.ts`, `**/*.e2e-spec.ts`)

- 允许使用 `any` 类型
- 放宽未使用变量检查
- 允许重复导入（测试工具需要）

### 种子文件 (`src/prisma/seed/**/*.ts`)

- 允许 `console.log`
- 允许循环中的 `await`
- 放宽未使用变量检查

### JavaScript 文件

- 基础 ES6+ 规则
- 不进行类型检查

## 🚀 使用命令

```bash
# 检查代码（不修复）
pnpm run lint:check

# 检查并自动修复
pnpm run lint:fix

# 只检查暂存文件
pnpm run lint:staged
```

## 📝 配置文件

- **eslint.config.mjs**: 主配置文件
- **.eslintignore**: 忽略文件列表
- **.prettierrc**: Prettier 配置（与 ESLint 协同）

## 🔄 与其他工具集成

### Prettier

- 自动处理代码格式化
- ESLint 专注于代码质量
- 避免规则冲突

### Husky + lint-staged

- 提交前自动检查
- 只检查变更文件
- 提高检查效率

### VS Code

建议安装以下扩展：

- ESLint
- Prettier - Code formatter
- TypeScript Importer

## ⚙️ 自定义配置

如需调整规则，请修改 `eslint.config.mjs` 文件中的 `rules` 部分。

### 常见调整示例

```javascript
// 放宽某个规则
'@typescript-eslint/no-explicit-any': 'warn', // 从 'error' 改为 'warn'

// 关闭某个规则
'no-console': 'off',

// 添加新规则
'prefer-template': 'error',
```

## 🐛 常见问题

### 1. 行尾符问题

已配置 `endOfLine: 'auto'` 处理不同操作系统的行尾符差异。

### 2. 导入路径问题

使用相对路径导入，避免绝对路径导致的问题。

### 3. 装饰器语法

已启用 `experimentalDecorators` 支持 NestJS 装饰器。

## 📚 参考资源

- [ESLint 官方文档](https://eslint.org/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [NestJS 官方文档](https://nestjs.com/)
- [Prettier 官方文档](https://prettier.io/)
