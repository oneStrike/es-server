# Task 与成长奖励整改开发补充

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

### [P0-07 成长规则值语义与校验对齐](./p0/07-growth-rule-semantics-and-validation-alignment.md)

- 开工条件：无硬前置，建议在 `P0-06` 完成后继续推进
- 预计改动模块：`libs/growth/point`、`libs/growth/experience`、`libs/growth/growth-ledger`
- 预计影响文件：
  - `libs/growth/src/point/point-rule.service.ts`
  - `libs/growth/src/point/dto/point-rule.dto.ts`
  - `libs/growth/src/experience/experience.service.ts`
  - `libs/growth/src/experience/dto/experience-rule.dto.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.constant.ts`
  - `db/schema/app/user-point-rule.ts`
  - `db/schema/app/user-experience-rule.ts`
- 核心测试点：
  - point/experience rule 创建与更新只允许合法 `GrowthRuleTypeEnum`
  - point/experience rule 的奖励值只允许正整数
  - `dailyLimit / totalLimit` 不允许负值
  - `applyByRule()` 遇到 `<= 0` 规则值时稳定拒绝，不再进入余额更新
  - 现有 task 奖励直发链路不受本轮规则收口误伤

## 3. 当前实施重点

本轮整改建议按以下顺序推进：

1. 先修 `reportProgress()` 与 `completeTask()` 的状态迁移条件
2. 再修 assignment 过期时间与发布时间窗口校验
3. 最后补齐并发、周期、完成模式相关自动化测试
4. 继续收口 point/experience rule 的数值语义与规则类型校验

## 4. 维护规则

- 若改动模块、关键文件或测试重点变化，再同步修改本文
- 若排期、状态或依赖变化，只修改 [execution-plan.md](./execution-plan.md)
- 若验收口径变化，只修改 [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)
