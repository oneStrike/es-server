# TASK: app-api Dockerfile 调整

## 1. 原子任务
- [ ] **Backup**: 备份原 Dockerfile (可选，git已有记录)。
- [ ] **Rewrite**: 重写 `apps/app-api/Dockerfile`。
    - 移除 Builder 阶段的源码复制和编译。
    - 添加依赖安装步骤。
    - 添加 `dist` 复制步骤。
    - 更新 ENTRYPOINT/CMD。
- [ ] **Verify**: 验证 Dockerfile 语法（通过 lint 或人工检查）。

## 2. 依赖关系
- 单一任务，无复杂依赖。
