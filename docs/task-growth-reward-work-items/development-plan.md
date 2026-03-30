# Task 模块状态流转整改开发补充

## 1. 文档目标

本文只补充开发执行所需的信息，不重新定义排期。

每个任务补充 4 类信息：

1. 开工条件
2. 预计改动模块
3. 预计影响文件
4. 核心测试点

## 2. Wave 1

### [P0-06 任务状态流转与并发审计收口](./p0/06-task-state-flow-and-audit-correction.md)

- 开工条件：无硬前置，可直接开工
- 预计改动模块：`libs/growth/task`、`apps/app-api/task`
- 预计影响文件：
  - `libs/growth/src/task/task.service.ts`
  - `libs/growth/src/task/task.service.spec.ts`
  - `libs/growth/src/task/task.constant.ts`
  - `libs/growth/src/task/dto/task.dto.ts`
  - `apps/app-api/src/modules/task/dto/task.dto.ts`
- 核心测试点：
  - `MANUAL` 任务达标后不会在 `progress` 阶段自动完成
  - `AUTO` 任务首次达标只完成一次，不产生重复完成日志或重复奖励
  - `reportProgress()` 乐观锁冲突不会留下伪造日志
  - `completeTask()` 乐观锁冲突不会留下伪造日志
  - `publishStartAt / publishEndAt` 边界被统一约束
  - `DAILY / WEEKLY / MONTHLY` assignment 具备按周期过期的可验证行为
  - 任务奖励与提醒链路不会因补偿或并发重试产生重复结果

## 3. 当前实施重点

本轮整改建议按以下顺序推进：

1. 先修 `reportProgress()` 与 `completeTask()` 的状态迁移条件
2. 再修 assignment 过期时间与发布时间窗口校验
3. 最后补齐并发、周期、完成模式相关自动化测试

## 4. 维护规则

- 若改动模块、关键文件或测试重点变化，再同步修改本文
- 若排期、状态或依赖变化，只修改 [execution-plan.md](./execution-plan.md)
- 若验收口径变化，只修改 [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)
