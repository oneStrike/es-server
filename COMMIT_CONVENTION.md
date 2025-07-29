# Git 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范来管理提交消息。

## 提交消息格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Type 类型

- **feat**: 新功能 (feature)
- **fix**: 修复bug
- **docs**: 文档更新
- **style**: 代码格式化，不影响代码逻辑
- **refactor**: 重构代码
- **perf**: 性能优化
- **test**: 测试相关
- **build**: 构建相关
- **ci**: CI/CD相关
- **chore**: 其他杂项
- **revert**: 回滚

### 示例

```bash
feat(auth): 添加用户登录功能

实现了基于JWT的用户认证系统，包括：
- 用户登录接口
- Token验证中间件
- 密码加密存储

Closes #123
```

```bash
fix(api): 修复用户信息更新接口的验证问题
```

```bash
docs: 更新API文档
```

## 使用方法

### 1. 使用 commitizen 进行交互式提交

```bash
pnpm run commit
```

这将启动一个交互式界面，引导您创建符合规范的提交消息。

### 2. 直接使用 git commit

确保您的提交消息符合上述格式规范。

## Git 钩子

项目配置了以下 Git 钩子：

- **pre-commit**: 在提交前运行 lint-staged，自动格式化和检查代码
- **commit-msg**: 验证提交消息是否符合规范

## 安装和设置

1. 安装依赖：

```bash
pnpm install
```

2. 初始化 husky：

```bash
pnpm run prepare
```

3. 现在您可以正常进行 git 操作，钩子会自动生效。

## 注意事项

- 提交消息的标题不应超过 100 个字符
- 如果有正文内容，请在标题和正文之间留一个空行
- 使用现在时态描述更改（"add" 而不是 "added" 或 "adds"）
- 首字母小写
- 结尾不要加句号
