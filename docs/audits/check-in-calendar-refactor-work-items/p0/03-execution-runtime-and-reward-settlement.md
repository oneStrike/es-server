# P0-03 重写签到执行、补签规则与运行态读模型

## 目标

- 让签到执行链路真正按自然周期、按日奖励和当前计划窗口工作。
- 同步收口管理端对账 / 补偿，以及 App 端摘要、日历和动作返回，避免继续暴露旧的滚动周期和统一基础奖励语义。

## 范围

- `libs/growth/src/check-in/check-in-execution.service.ts`
- `libs/growth/src/check-in/check-in-runtime.service.ts`
- `libs/growth/src/check-in/check-in.service.support.ts`
- `libs/growth/src/check-in/dto/check-in-runtime.dto.ts`
- `libs/growth/src/check-in/dto/check-in-execution.dto.ts`
- `libs/growth/src/check-in/check-in.service.ts`
- `apps/admin-api/src/modules/check-in/check-in.controller.ts`
- `apps/app-api/src/modules/check-in/check-in.controller.ts`

## 当前代码锚点

- 当前周期边界仍按 `startDate` 锚定滚动推导：`libs/growth/src/check-in/check-in.service.support.ts`
- 当前签到记录插入是否需要结算基础奖励只看 `snapshot.baseRewardConfig`：`libs/growth/src/check-in/check-in-execution.service.ts`
- 当前基础奖励结算直接读取统一 `baseRewardConfig`：`libs/growth/src/check-in/check-in-execution.service.ts`
- 当前 App 端日历视图未返回按日奖励所需字段：`libs/growth/src/check-in/dto/check-in-runtime.dto.ts`
- 当前管理端对账 / 补偿链路仍建立在旧基础奖励解释之上：`libs/growth/src/check-in/check-in-runtime.service.ts`、`libs/growth/src/check-in/check-in-execution.service.ts`

## 非目标

- 不在本任务中重新设计管理端排期切换合同。
- 不在本任务中扩展跨周期连续奖励或跨周期补签能力。
- 不在本任务中兼容旧前端字段。

## 主要改动

- 重写周期解析逻辑，`weekly` 固定按周一到周日，`monthly` 固定按每月 `1` 号到月末。
- 让签到 / 补签统一基于“当前生效计划 + 当前自然周期”执行，不再沿用滚动周期窗口。
- 补签校验只允许补当前周期内、今天之前、未签到的日期，并继续受每周期补签次数限制。
- 基础奖励结算改为根据 `signDate -> dayIndex -> resolvedRewardConfig` 解析当天奖励，不再直接读取统一基础奖励。
- 在签到记录、管理端对账视图和动作返回中暴露与按日奖励结算一致的字段，便于对账、补偿与前端后续接入。
- 日历与摘要读模型补齐按日奖励展示所需字段，例如 `dayIndex`、是否在计划窗口内、当日计划奖励等。
- 奖励补偿入口改为复用签到记录 / 周期快照中的已冻结奖励解释，避免补偿时回查已废弃的统一基础奖励配置。
- 连续奖励继续按当前周期内的签到事实重算，跨周期或切换到新计划后重新开始。

## 完成标准

- 签到、补签和运行态读模型都不再依赖滚动周期解释。
- 基础奖励能按 `dayIndex` 稳定结算，且签到记录保留稳定的奖励解析快照。
- 管理端对账 / 补偿以及 App 端日历、摘要和动作返回的字段语义与自然周期、按日奖励模型一致。
- 连续奖励在当前周期内可正确触发，跨周期与计划切换后能够稳定重置。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-03` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中的 App 契约影响与验证重点。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录执行链路与运行态契约证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-03` 为唯一事实源。
