# P0-01 任务域职责边界与类型语义收敛

## 1. 目标

明确 `task` 模块在全链路中的职责边界，避免它继续同时承担“事件类型、奖励规则、发布模板、运营标签”多种角色。

本任务要产出的核心结论是：

- `task` 只负责“任务包装、发布、用户 assignment、任务 bonus 奖励、任务提醒”；
- “用户发生了什么行为”继续由事件定义与 `GrowthRuleTypeEnum` 表达；
- “行为默认给多少积分/经验”继续由积分规则、经验规则负责；
- `task.type` 改成稳定的场景语义，不再混入周期与运营来源。

## 2. 范围

本任务覆盖以下代码与设计面：

- 任务域枚举与类型：
  - `libs/growth/src/task/task.constant.ts`
  - `libs/growth/src/task/task.type.ts`
- 任务表与 assignment 快照字段语义：
  - `db/schema/app/task.ts`
  - `db/schema/app/task-assignment.ts`
- 任务管理 DTO / App DTO：
  - `libs/growth/src/task/dto/task.dto.ts`
  - `apps/app-api/src/modules/task/dto/task.dto.ts`
- 任务服务中所有依赖 `type` 进行展示、过滤或判断的逻辑：
  - `libs/growth/src/task/task.service.ts`
- 初始化种子与运营配置语义：
  - `db/seed/modules/app/domain.ts`
- 文档与管理后台口径。

## 3. 当前代码锚点

- `TaskTypeEnum` 当前包含 `NEWBIE / DAILY / REPEAT / ACTIVITY / OPERATION`，语义混合了“用户场景、周期语义、运营来源”三种维度：
  - `libs/growth/src/task/task.constant.ts`
- `repeatRule` 已经表达周期，但 `type=REPEAT` 又重复表达一次周期：
  - `libs/growth/src/task/task.service.ts`
  - `db/schema/app/task.ts`
- seed 数据里存在标题是“每日任务”但 `type` 实际写成 `NEWBIE` 的情况，说明配置语义已经漂移：
  - `db/seed/modules/app/domain.ts`
- App/Admin 当前没有严格区分“场景分类”和“活动来源”，导致运营只能把所有概念塞进 `type`：
  - `apps/admin-api/src/modules/task/task.controller.ts`
  - `apps/app-api/src/modules/task/task.controller.ts`

## 4. 非目标

- 本任务不负责直接落地事件驱动任务推进；
- 不负责拆 `task_template / task_publish / campaign` 三表；
- 不负责改写积分规则、经验规则的底层结算逻辑；
- 不负责新增复杂表达式引擎、多步骤任务编排或规则 DSL；
- 不负责补齐所有历史脏数据修复脚本，只定义迁移原则与兜底策略。

## 5. 主要改动

### 5.1 收敛任务域职责

在文档、类型、DTO、后台配置说明中统一任务域职责：

- `task` 是运营任务层，不是行为事件定义层；
- `task` 消费业务事件或手动确认结果来推进进度；
- `task.rewardConfig` 是任务 bonus，不替代基础成长规则；
- `task` 的发布、提醒、奖励对账都围绕 assignment 展开。

### 5.2 重定义 `task.type`

将 `task.type` 收敛为稳定的“任务场景类型”，建议最小集合为：

- `ONBOARDING`：新手引导类任务；
- `DAILY`：日常/周期性任务；
- `CAMPAIGN`：活动或运营专题任务。

允许保留扩展位，但本阶段不新增更多枚举。

同时执行以下收口动作：

- 移除 `REPEAT` 作为类型值，周期统一只由 `repeatRule` 表达；
- 移除 `OPERATION` 作为核心类型值，运营来源长期建议独立为 `sourceTag` / `campaignId` 维度，本轮先不落地；
- `ACTIVITY` 并入 `CAMPAIGN`，避免“活动/运营”双口径并存。

### 5.3 本轮未纳入的来源维度字段

以下字段在本轮评审中被识别为后续可能需要的来源语义，但没有纳入 `P0-01` 的实际落地范围：

- `sourceTag`：运营来源标签，例如 `growth-center`、`reading-week`；
- `campaignId`：活动归属标识；
- `displayGroup`：前端展示分组。

本轮决议：

- 不在 `task` schema / DTO / 读模型中新增上述字段；
- 当前仍以 `type + code + objective model + publish window` 承载最小可解释语义；
- 若未来确实需要拆“场景”和“来源”两个维度，以后续结构升级任务为准，不倒灌到 `P0-01` 完成标准。

### 5.4 清理类型相关的服务分支

审查 `TaskService` 中所有依赖 `type` 的判断，将它们改为依赖明确字段：

- 周期判断依赖 `repeatRule`；
- 是否自动建 assignment 依赖 `claimMode`；
- 是否自动完成依赖 `completeMode`；
- 展示归属当前只依赖 `type`，历史值通过兼容映射归一；
- 活动窗口依赖 `publishStartAt/publishEndAt/status/isEnabled`。

### 5.5 补齐迁移策略

为历史数据定义一次性迁移规则：

- `NEWBIE` 迁移为 `ONBOARDING`；
- `DAILY` 保持 `DAILY`；
- `ACTIVITY`、`OPERATION` 迁移为 `CAMPAIGN`；
- `REPEAT` 根据标题、已有 `repeatRule` 与运营上下文回填为 `DAILY` 或 `CAMPAIGN`，无法自动判断的记录进入人工复核清单。

### 5.6 补齐配置与文档口径

- 更新后台字段说明与接口注释；
- 更新 seed 注释与初始化文案；
- 在开发文档中写明“行为事件 != 任务类型 != 奖励类型”的关系图。

## 6. 完成标准

- `task.type` 在代码、DTO、文档中只表达场景语义，不再出现周期/运营来源含义；
- `REPEAT`、`OPERATION` 不再作为对外可配置类型；
- 周期、领取、完成等执行语义已不再混用 `type`；
- 已形成历史数据迁移/映射方案，并列出人工复核入口；
- App、Admin、seed、文档的类型文案保持一致；
- `sourceTag / campaignId / displayGroup` 已明确不属于本任务完成条件；
- 回归测试覆盖：
  - 创建/更新任务时的新类型校验；
  - 历史类型映射；
  - 列表展示与筛选不受旧枚举歧义影响。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 管理后台任务配置说明文档
- 若实施时新增迁移脚本，需同步脚本执行说明与回滚说明

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P0-01`；
- 完成后直接解锁：`P0-02`、`P0-03`。
