# P0-01 重建自然周期与按日奖励数据基础

## 目标

- 把签到模块的周期语义从“计划开始日滚动切片”收口为真实自然周 / 月。
- 为按日奖励、周期快照和历史对账建立唯一的数据模型基础。

## 范围

- `db/schema/app/check-in-plan.ts`
- `db/schema/app/check-in-cycle.ts`
- `db/schema/app/check-in-record.ts`
- `db/schema/app/check-in-streak-reward-rule.ts`
- `db/schema/app/check-in-streak-reward-grant.ts`
- 新增 `db/schema/app/check-in-daily-reward-rule.ts`
- `db/schema/index.ts`
- `db/relations/app.ts`
- `libs/growth/src/check-in/check-in.type.ts`
- `libs/growth/src/check-in/dto/check-in-cycle.dto.ts`
- `libs/growth/src/check-in/dto/check-in-record.dto.ts`
- `db/comments/generated.sql`
- `db/migration/*`

## 当前代码锚点

- 当前计划表仍以 `baseRewardConfig` 承载统一基础奖励：`db/schema/app/check-in-plan.ts`
- 当前关系定义里还不存在按日奖励规则 owner：`db/relations/app.ts`
- 当前周期快照只冻结统一基础奖励和连续奖励规则：`libs/growth/src/check-in/check-in.service.support.ts`
- 当前记录表未冻结按日奖励解析结果：`db/schema/app/check-in-record.ts`
- 当前内部类型和基础 DTO 仍围绕 `baseRewardConfig` 组织：`libs/growth/src/check-in/check-in.type.ts`

## 非目标

- 不在本任务中改管理端创建 / 更新接口。
- 不在本任务中改 App 端签到执行和补签判断。
- 不在本任务中补齐所有自动化测试与命令证据。
- 不兼容历史数据，也不保留长期双写字段。

## 主要改动

- 为基础奖励新增独立的按日奖励规则表 owner，按 `planId + planVersion + dayIndex` 建模。
- 让周计划只允许 `dayIndex = 1..7`，月计划只允许 `dayIndex = 1..31`。
- 清理或废弃计划表上的统一 `baseRewardConfig` 语义，避免继续作为基础奖励唯一事实源。
- 同步补齐按日奖励规则与计划 / 记录 / 周期的关系定义，避免 schema 与 relation graph 漂移。
- 扩展周期快照结构，把 `dailyRewardRules` 与连续奖励规则一起冻结到 `check_in_cycle.planSnapshot`。
- 为签到记录补齐按日奖励解析结果快照字段，例如 `rewardDayIndex`、`resolvedRewardConfig`，确保后续对账、补偿和历史展示具备稳定依据。
- 同步更新基础实体 DTO，使记录 / 周期基类与新增 schema 字段、快照结构保持一致。
- 同步更新 Drizzle 推导类型、导出入口与字段注释产物。

## 完成标准

- Schema、relation、内部类型和基础 DTO 中只保留一套按日奖励 owner，不存在第二套基础奖励事实源。
- 周 / 月计划的 `dayIndex` 上限约束明确、可校验。
- `check_in_record` 已具备稳定记录“签到当日按哪一天、发了什么奖励”的字段基础。
- `db/comments/generated.sql` 已同步更新，相关字段注释能准确表达自然周期和按日奖励语义。
- 迁移生成前置修改已准备完成，等待规范流程生成迁移。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-01` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中受影响的 schema / 类型 owner。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录 schema 与迁移证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-01` 为唯一事实源。
