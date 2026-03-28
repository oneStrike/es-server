# P0-04 主题审核通过奖励补发

## 目标

让进入待审核的主题在首次通过审核后也能正确获得 `CREATE_TOPIC` 奖励。

## 范围

- 识别审核状态变更前后值
- 只在符合条件时触发补发
- 复用已有发帖奖励幂等键

## 当前代码锚点

- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/growth/src/growth-reward/growth-reward.service.ts`
- `db/schema/app/growth-ledger-record.ts`
- `libs/platform/src/constant/audit.constant.ts`

## 非目标

- 不处理历史存量主题的离线补账
- 不改主题审核状态本身的存储模型
- 不把奖励失败升级为审核提交流程的阻断条件

## 主要改动

- 在审核更新流程里先读取旧状态
- 只有旧值为 `PENDING` 且新值变为 `APPROVED` 时，才执行补发检查
- 奖励失败时记日志，不阻塞审核提交
- 继续复用发帖奖励既有 `bizKey` / 幂等约束，避免“即时发奖”和“审核后补发”双发

## 完成标准

- 直接通过审核的主题仍即时发奖
- 待审核后首次 `PENDING -> APPROVED` 的主题补发一次
- 除 `PENDING -> APPROVED` 外的其他状态迁移不会误触发补发
- 已发过奖的主题不会重复发账

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- 若治理闸门语义调整，同时同步 [P2-C-01 治理闸门统一](../p2c/01-governance-gate-unification.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
