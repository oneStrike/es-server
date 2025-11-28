## 问题分析
用户希望在 Gitea Actions 工作流中，只有当 `package.json` 文件发生变化时才执行 `pnpm install --frozen-lockfile` 步骤，以优化 CI 执行时间。

## 解决方案
我将使用 `dorny/paths-filter` 动作来实现基于文件变化的条件执行，这是一个可靠且广泛使用的解决方案。

### 实现步骤
1. 在现有工作流中添加 `dorny/paths-filter` 动作，用于检查 `package.json` 和 `pnpm-lock.yaml` 文件是否发生变化
2. 为依赖安装步骤添加 `if` 条件，只有当上述文件变化时才执行
3. 同时检查 `pnpm-lock.yaml` 文件，因为依赖变化时该文件也会更新

### 代码修改
```yaml
# 在 Checkout 步骤后添加
- name: Check if package files changed
  uses: dorny/paths-filter@v2
  id: changes
  with:
    filters: |
      deps:
        - 'package.json'
        - 'pnpm-lock.yaml'

# 修改现有依赖安装步骤
- name: 安装项目依赖
  if: ${{ steps.changes.outputs.deps == 'true' }}
  run: pnpm install --frozen-lockfile
```

## 预期效果
- 当 `package.json` 或 `pnpm-lock.yaml` 文件未发生变化时，跳过依赖安装步骤
- 当上述文件发生变化时，正常执行依赖安装步骤
- 优化 CI 执行时间，避免不必要的依赖安装

## 兼容性
- 该方案基于 GitHub Actions 语法，Gitea Actions 完全支持
- `dorny/paths-filter` 是一个广泛使用的开源动作，可靠性高
- 同时检查 `pnpm-lock.yaml` 文件，确保依赖变化时能正确触发安装
