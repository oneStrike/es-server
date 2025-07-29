# 开发工作流程指南

本项目已配置了完整的工程化开发流程，包括代码格式化、代码检查和提交规范。

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 初始化 Git 钩子

```bash
npx husky init
```

## 📝 提交代码

### 方式一：使用交互式提交（推荐）

```bash
pnpm run commit
```

这将启动一个交互式界面，引导您创建符合规范的提交消息。

### 方式二：直接提交

```bash
git add .
git commit -m "feat: 添加新功能"
```

确保提交消息符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 🔧 工具说明

### Git 钩子

- **pre-commit**: 提交前自动运行 `lint-staged`，检查暂存文件的代码质量
- **commit-msg**: 提交时验证提交消息格式是否符合 Conventional Commits 规范

### 代码质量工具

- **ESLint**: 代码静态分析工具，检查代码质量和风格
  - 集成了 TypeScript 支持
  - 包含 NestJS 最佳实践规则
  - 与 Prettier 协同工作
  - 支持自动修复
- **Prettier**: 代码格式化工具，统一代码风格
- **lint-staged**: 只对暂存文件运行检查，提高效率

### 提交规范工具

- **commitlint**: 验证提交消息格式
- **commitizen**: 提供交互式提交界面

## 📋 提交类型

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 重构代码
- `perf`: 性能优化
- `test`: 测试相关
- `build`: 构建相关
- `ci`: CI/CD相关
- `chore`: 其他杂项
- `revert`: 回滚

## 🎯 最佳实践

1. **提交前检查**: Git钩子会自动运行，确保代码质量
2. **小而频繁的提交**: 每个提交应该只包含一个逻辑变更
3. **清晰的提交消息**: 使用规范的格式描述变更内容
4. **代码审查**: 提交前自我审查代码变更

## 🛠️ 手动运行工具

如果需要手动运行这些工具，可以使用以下命令：

```bash
# 代码检查
pnpm run lint:check          # 检查代码问题（不修复）
pnpm run lint:fix            # 检查并自动修复代码问题
pnpm run lint:staged         # 检查暂存文件

# 代码格式化
pnpm run format              # 格式化所有代码文件
pnpm run format:check        # 检查代码格式（不修复）

# 提交消息验证
echo "feat: your message" | npx commitlint  # 测试提交消息格式
```

## 📚 相关文档

- [提交规范详细说明](./COMMIT_CONVENTION.md)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [ESLint 配置](./eslint.config.mjs)
- [Prettier 配置](./.prettierrc)
