# 签到模块改造开发补充

## 开工条件

- 单一生效计划、非立即切换、自然周 / 月周期和按日奖励口径以 [README.md](./README.md) 为准，不再派生第二套语义。
- 计划日期边界对齐校验已确认纳入本轮实现，不在执行层继续兼容半周期生效。
- 数据库迁移通过 `pnpm db:generate` 生成；若存在交互式确认，由用户亲自执行。
- 涉及 schema 字段注释变更时，同步更新 `db/comments/generated.sql`，并通过 `pnpm db:comments:check` 校验。
- 本轮不兼容历史数据，也不为旧字段保留长期双写。

## 影响模块

### Schema 与关系定义

- `db/schema/app/check-in-plan.ts`
- `db/schema/app/check-in-cycle.ts`
- `db/schema/app/check-in-record.ts`
- `db/schema/app/check-in-streak-reward-rule.ts`
- `db/schema/app/check-in-streak-reward-grant.ts`
- 新增 `db/schema/app/check-in-daily-reward-rule.ts`
- `db/schema/index.ts`
- `db/relations/app.ts`
- `db/comments/generated.sql`
- `db/migration/*`

### DTO 与内部类型

- `libs/growth/src/check-in/check-in.type.ts`
- `libs/growth/src/check-in/dto/check-in-cycle.dto.ts`
- `libs/growth/src/check-in/dto/check-in-plan.dto.ts`
- `libs/growth/src/check-in/dto/check-in-definition.dto.ts`
- `libs/growth/src/check-in/dto/check-in-record.dto.ts`
- `libs/growth/src/check-in/dto/check-in-runtime.dto.ts`
- `libs/growth/src/check-in/dto/check-in-execution.dto.ts`
- `libs/growth/src/check-in/dto/check-in-reward-config.dto.ts`
- 新增 `libs/growth/src/check-in/dto/check-in-daily-reward-rule.dto.ts`

### 服务与模块

- `libs/growth/src/check-in/check-in.service.support.ts`
- `libs/growth/src/check-in/check-in-definition.service.ts`
- `libs/growth/src/check-in/check-in-execution.service.ts`
- `libs/growth/src/check-in/check-in-runtime.service.ts`
- `libs/growth/src/check-in/check-in.service.ts`
- `libs/growth/src/check-in/check-in.module.ts`
- `apps/admin-api/src/modules/check-in/check-in.controller.ts`
- `apps/app-api/src/modules/check-in/check-in.controller.ts`

### 测试与验证

- `libs/growth/src/check-in/**/*.spec.ts`（若已有）
- `apps/admin-api` / `apps/app-api` 针对签到模块的相关 spec
- 如缺少现成 spec，新增最小必要的长期自动化测试

## 统一实现约束

- `weekly` 与 `monthly` 必须映射为真实自然周 / 月，不再复用“计划开始日滚动切片”逻辑。
- `startDate / endDate` 只承载计划生效窗口，不参与周期锚点推导。
- 任一自然日只能命中一个生效计划；排期切换通过未来生效窗口完成，不允许立即切换。
- 周计划日期边界必须对齐周一 / 周日；月计划日期边界必须对齐月初 / 月末。
- `dailyRewardRules` 是基础奖励唯一事实源；不得再在执行链路中直接依赖统一 `baseRewardConfig`。
- 后台对账与补偿入口必须基于签到记录 / 周期快照解释奖励，不得在运行时回查已废弃的统一基础奖励语义。
- 连续奖励继续归属于 `planVersion`，并且只在当前周期内计算；进入下个周期或切换到新计划后重新开始。
- 补签只允许发生在当前周期内、今天之前、未签到的日期，并继续受每周期补签次数限制。
- App 端前端尚未接入，本轮允许直接调整 DTO，但必须保证同一接口内字段语义自洽，不保留含糊兼容字段。

## 接口契约影响

### 管理端

- 计划创建 / 更新 DTO 需要从统一基础奖励切换为按日奖励规则输入。
- 计划详情 DTO 需要返回 `dailyRewardRules` 与连续奖励规则，不再只暴露 `baseRewardConfig`。
- 计划创建 / 更新 / 状态流转需要收口“自然周期边界对齐”“非立即切换”“计划窗口不重叠”等校验语义。
- 对账分页与奖励补偿入口需要复用签到记录 / 周期快照中的按日奖励解析结果，避免后台排障仍停留在旧统一奖励语义。

### App 端

- `summary` 需要返回自然周期窗口、当前周期统计和下一档连续奖励的新语义。
- `calendar` 需要返回按日奖励展示所需字段，至少应包含 `dayIndex`、是否在计划窗口内以及当日计划奖励。
- `sign` / `makeup` 的动作返回需要与按日奖励结算结果对齐，避免继续使用“统一基础奖励”语义。

## 测试与验证重点

- `pnpm type-check`
- `pnpm db:comments:check`
- 变更文件 `eslint`
- 签到计划创建 / 更新的边界校验：
  - 自然周 / 月边界对齐
  - 排期窗口不重叠
  - 不允许立即切换
- 当前生效计划读取与未来计划排期读取的服务层测试
- 自然周期计算、`dayIndex` 推导和跨周期重置测试
- 按日奖励解析、基础奖励结算和记录快照写入测试
- 连续奖励在同周期内触发、跨周期重置、计划切换后重置测试
- App 端摘要、日历、动作返回契约测试
- 管理端对账分页与奖励补偿入口回归测试

## 风险提示

- `P0-01` 与 `P0-02` 都会修改计划模型、快照结构与 DTO，若先后顺序失控，容易出现 schema 已改但管理端仍输出旧契约的漂移。
- `P0-02` 与 `P0-03` 共享 `check-in.service.support.ts` 和核心 DTO，默认不建议并行改写。
- 若仅替换 DTO 字段而未补齐 `check_in_record` 的奖励解析快照，后续对账与历史展示会缺少稳定证据。
- 若自然周期计算改掉但补签窗口仍沿用旧逻辑，会出现“周期已自然化、补签仍按滚动窗口判断”的语义分裂。
- 若 `P0-03` 只收口 App 端接口而遗漏管理端对账 / 补偿链路，运营排障仍会读到旧 `baseRewardConfig` 语义。
