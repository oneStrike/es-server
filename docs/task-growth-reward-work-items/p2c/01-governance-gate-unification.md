# P2-C-01 治理闸门统一

## 目标

让审核和裁决真正成为奖励、通知、任务推进的正式前置条件。

## 范围

- 定义统一治理门控语义
- 明确哪些事件可以进入主链路
- 收敛主题、评论、举报的治理口径

## 当前代码锚点

- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/report/report.service.ts`
- `libs/platform/src/constant/audit.constant.ts`
- `libs/interaction/src/report/report.constant.ts`

## 非目标

- 不把主题、评论、举报强行改成同一个存储模型或同一个枚举
- 不重做现有审核后台或举报处理后台
- 不让待审核内容默认进入公开展示、奖励或通知主链路

## 主要改动

- 用统一门控语义映射各模块自己的状态，而不是要求底层状态值完全相同
- 约束只有有效治理态才能进入奖励、通知、任务推进主链路
- 规定待审核内容是否允许进入提醒或待办链路
- 收口模块间对 `APPROVED / PENDING / REJECTED / RESOLVED` 的业务含义

## 完成标准

- 审核与裁决不再只是后台字段，而是正式闸门
- 主题、评论、举报在门控层语义一致
- 后续评论审核、通知边界、chat outbox 闭环可复用同一治理前置

## 当前状态

- `CREATE_TOPIC / CREATE_COMMENT / REPORT_VALID / REPORT_INVALID` 已进入 consumer-aware governance gate
- 评论审核后台现已直接复用 `COMMENT_APPROVAL` 门控，评论待审核时不会提前进入奖励 / 通知主链路
- 评论在后台首次变为可见时，会基于统一门控补发奖励与通知；再次复核不会重复发放

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [事件定义专项设计](../../event-registry-special-design.md)
- 若影响通知域边界，同时同步 [通知域契约](../../notification-domain-contract.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
