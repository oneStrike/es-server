# P0-02 收口管理端计划定义与排期切换语义

## 目标

- 让管理端计划定义、版本冻结和排期切换完全对齐“自然周期 + 非立即切换 + 单日唯一生效计划”的业务口径。
- 为执行层和运行态提供唯一的计划定义合同，不再在下游派生第二套切换规则。

## 范围

- `libs/growth/src/check-in/dto/check-in-plan.dto.ts`
- `libs/growth/src/check-in/dto/check-in-definition.dto.ts`
- 新增 `libs/growth/src/check-in/dto/check-in-daily-reward-rule.dto.ts`
- `libs/growth/src/check-in/check-in-definition.service.ts`
- `libs/growth/src/check-in/check-in.service.support.ts`
- `libs/growth/src/check-in/check-in.service.ts`
- `apps/admin-api/src/modules/check-in/check-in.controller.ts`

## 当前代码锚点

- 当前管理端 DTO 仍暴露统一 `baseRewardConfig`：`libs/growth/src/check-in/dto/check-in-plan.dto.ts`
- 当前计划创建 / 更新仅校验单个当前生效计划，不处理未来排期切换：`libs/growth/src/check-in/check-in-definition.service.ts`
- 当前版本递增判断仍围绕 `baseRewardConfig` 与连续奖励规则：`libs/growth/src/check-in/check-in.service.support.ts`
- 当前生效计划查询逻辑以“当前唯一有效计划”为目标，但未显式表达“未来计划排期、不立即切换”语义：`libs/growth/src/check-in/check-in.service.support.ts`

## 非目标

- 不在本任务中改签到执行链路的奖励结算逻辑。
- 不在本任务中改 App 端摘要、日历和动作返回。
- 不在本任务中做历史数据迁移或兼容层。

## 主要改动

- 管理端计划 DTO 全量切换为 `dailyRewardRules + streakRewardRules` 输入 / 输出结构。
- 在计划创建 / 更新时新增自然周期边界对齐校验：
  - 周计划 `startDate` 对齐周一，`endDate` 若存在则对齐周日。
  - 月计划 `startDate` 对齐月初，`endDate` 若存在则对齐月末。
- 收口已发布计划窗口不重叠校验，确保任一自然日只存在一个生效计划。
- 明确排期切换语义：
  - 允许未来计划排期。
  - 不允许当前周期立即切换。
  - 新计划只能从未来自然周期边界开始生效。
- 让 `plan.version` 的变更判断覆盖 `dailyRewardRules`、连续奖励规则和计划窗口等关键解释字段。
- 计划详情读模型补齐按日奖励规则与当前版本连续奖励规则，避免管理端继续依赖旧字段。

## 完成标准

- 管理端签到计划 DTO 中不再保留模糊的统一基础奖励语义。
- 计划创建 / 更新 / 发布能稳定拦截日期边界不合法、计划窗口重叠和立即切换等非法输入。
- `plan.version` 的递增条件能够覆盖所有会影响签到解释的关键配置。
- 管理端详情返回可完整表达本计划当前版本的按日奖励与连续奖励规则。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-02` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中的管理端契约影响与校验重点。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录管理端契约与排期切换证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-02` 为唯一事实源。
