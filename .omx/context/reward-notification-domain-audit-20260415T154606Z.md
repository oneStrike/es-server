## Task Statement

按项目规范，对“用户奖励发放”和“消息通知”做完整代码审查，且不能只看主模块，必须覆盖与其直接关联的业务模块与链路。

## Desired Outcome

产出一份按项目规范组织的完整审查结果，覆盖奖励与通知相关模块、跨模块调用链、数据库契约、测试覆盖与风险点，并明确必须修复项、建议修改项、验证缺口与剩余风险。

## Stated Solution

用户显式要求使用 `$deep-interview`，先澄清审查边界与交付方式，再进入正式审查。

## Probable Intent Hypothesis

用户担心出现“只审查主模块、不审查关联模块”的片面审查，希望得到一份面向业务链路而不是目录边界的全量域审查结果。

## Known Facts / Evidence

- 已定位消息通知主域：`libs/message/src/notification/*`
- 已定位通知事件链路：`libs/message/src/eventing/*`
- 已定位奖励相关主域：
  - `libs/growth/src/point/*`
  - `libs/growth/src/experience/*`
  - `libs/growth/src/growth-reward/*`
- 已定位直接关联能力：
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts`
  - `libs/growth/src/task/task-notification.service.ts`
  - `db/schema/app/user-point-rule.ts`
  - `db/schema/app/user-experience-rule.ts`
  - `db/schema/app/check-in-streak-reward-grant.ts`
  - `db/schema/message/*`
- 已存在通知专项审查文档：
  - `docs/reviews/2026-04-15-user-notification-module-audit.md`
  - `docs/reviews/2026-04-15-user-notification-app-breaking.md`
- 仓库验证基线：
  - 代码改动至少执行 `pnpm type-check`
  - 行为 / 契约变更应补充对应测试

## Constraints

- 审查必须遵循 `AGENTS.md` 与 `.trae/rules/PROJECT_RULES.md`
- 不得只按单个模块目录做孤立审查
- 审查需要覆盖 DTO、Service、Controller、Module、schema、事件链路、测试
- 当前为 brownfield 仓库，代码事实优先于历史文档

## Unknowns / Open Questions

- 审查对象是“当前工作区现状的全量域实现”，还是“某个近期改动 / PR 的变更集”
- 交付物是新增统一审查文档、直接对话输出，还是两者都要
- 是否需要把现有通知专项审查结论并入新的统一报告

## Decision-Boundary Unknowns

- 我是否可以默认以“当前工作区现状”作为审查对象
- 我是否可以默认复用已有通知专项审查结论，并在其基础上补齐奖励链路与交叉模块
- 我是否可以默认输出一份新的统一审查报告到 `docs/reviews/`

## Likely Codebase Touchpoints

- `apps/admin-api/src/modules/message/*`
- `apps/app-api/src/modules/message/*`
- `apps/admin-api/src/modules/growth/point/*`
- `apps/admin-api/src/modules/growth/experience/*`
- `libs/message/src/notification/*`
- `libs/message/src/eventing/*`
- `libs/growth/src/point/*`
- `libs/growth/src/experience/*`
- `libs/growth/src/growth-reward/*`
- `libs/growth/src/check-in/*`
- `libs/growth/src/task/*`
- `libs/app-content/src/announcement/*`
- `db/schema/message/*`
- `db/schema/app/user-point-rule.ts`
- `db/schema/app/user-experience-rule.ts`
- `db/schema/app/check-in-streak-reward-grant.ts`
