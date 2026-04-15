# 奖励发放 / 消息通知域审查访谈记录

- 时间：2026-04-15T15:51:46Z
- 模式：`deep-interview`
- Profile：`standard`
- Context：`brownfield`
- 最终加权歧义度：`6.1%`
- 阈值：`20%`

## 结论摘要

本次任务按“当前工作区现状”执行全链路域审查，不是针对某个单独 PR 或变更集。

审查必须覆盖：

- 奖励发放主链路：积分、经验、奖励聚合、签到奖励、任务奖励等
- 消息通知主链路：站内通知、模板、偏好、投影、投递、实时推送、管理端监控
- 只消费奖励结果或通知结果的读接口
- 与上述链路直接耦合的共享基础设施

审查不继续无限外扩到与本主题无关、仅偶然复用同一基础设施的其他业务域，例如 chat、comment 等。

## 轮次记录

### Round 1

- Target：`Scope`
- Q：这次我应当默认按“当前工作区现状”做全链路域审查，并把现有通知专项结论并入新的统一报告，还是只针对某个近期改动 / 分支 / PR 做增量审查？
- A：按“当前工作区现状”做全链路域审查，并把现有通知专项结论并入新的统一报告。

### Round 2

- Target：`Non-goals`
- Q：这次审查要不要把这类“只消费奖励结果、不参与发放/通知决策”的读接口也纳入；还是明确排除，只审查发放、落账、通知生成、投递、用户查询主链路？
- A：“只消费奖励结果、不参与发放/通知决策”的读接口也纳入。

### Round 3

- Target：`Decision Boundaries`
- Q：如果我发现这类共享基础设施存在问题，你希望我只审查“它们对奖励/通知链路造成的具体影响”，还是把这些共享基础设施本身也扩成独立完整审查范围？
- A：把这些共享基础设施本身也扩成独立完整审查范围。

### Round 4

- Target：`Non-goals / Pressure Pass`
- Q：如果按“共享基础设施本身也完整审查”无限外扩，范围会自然延伸到平台事件总线、JWT 鉴权、分页扩展、统一错误处理，而且这些基础设施又被 chat、comment 等不属于本次业务主题的域复用。这里是否仍然只围绕“奖励发放 / 消息通知 / 其读接口”相关链路来审查这些基础设施本身，而不继续外扩到这些无关业务域？
- A：仍然只围绕“奖励发放 / 消息通知 / 其读接口”相关链路来审查这些基础设施本身。

## Pressure Pass

- Revisited answer：Round 3 的“共享基础设施也要完整审查”
- Hidden assumption exposed：如果不加边界，这个要求会把审查范围从主题域扩成整仓基础设施普查
- Resolution：共享基础设施纳入，但仅限与“奖励发放 / 消息通知 / 其读接口”主题相关的调用链、契约、实现与复用风险

## Brownfield 证据

- 已识别通知主域：`libs/message/src/notification/*`
- 已识别通知事件链路：`libs/message/src/eventing/*`
- 已识别奖励主域：
  - `libs/growth/src/point/*`
  - `libs/growth/src/experience/*`
  - `libs/growth/src/growth-reward/*`
  - `libs/growth/src/check-in/*`
  - `libs/growth/src/task/*`
- 已识别读接口消费者：
  - `apps/app-api/src/modules/user/user.service.ts`
  - `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
  - `libs/forum/src/profile/profile.service.ts`
- 已识别共享基础设施候选：
  - `db/extensions/findPagination.ts`
  - `db/core/drizzle.service.ts`
  - `db/core/error/error-handler.ts`
  - `libs/platform/src/decorators/validate/contract.ts`
  - `libs/platform/modules/eventing/*`
  - `libs/platform/modules/auth/*`
  - `libs/platform/utils/time*`
  - `libs/message/src/notification/notification-websocket.service.ts`
  - `libs/message/src/notification/notification-native-websocket.server.ts`
- 已存在通知专项审查文档：
  - `docs/reviews/2026-04-15-user-notification-module-audit.md`
  - `docs/reviews/2026-04-15-user-notification-app-breaking.md`
