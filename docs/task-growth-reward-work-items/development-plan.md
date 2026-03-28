# 开发排期版

## 1. 文档目标

本文只补开发执行所需的信息，不涉及人员配置。

每个任务补充 4 类内容：

1. 开工条件
2. 预计改动模块
3. 预计影响文件
4. 核心测试点

说明：

- 文件清单只列关键路径，不追求穷举
- 波次顺序以 [execution-plan.md](./execution-plan.md) 为准

## 2. Wave 1

### [P0-01 业务口径与规则编码对齐](./p0/01-policy-and-rule-code-alignment.md)

- 开工条件：无
- 预计改动模块：`libs/growth`、`db/schema/app`、`db/seed/modules/app`、`docs`
- 预计影响文件：
  - `libs/growth/src/growth-rule.constant.ts`
  - `db/schema/app/user-point-rule.ts`
  - `db/schema/app/user-experience-rule.ts`
  - `db/seed/modules/app/domain.ts`
  - `docs/task-growth-reward-domain-design.md`
- 核心测试点：
  - 规则校验服务只接受当前编码口径
  - seed 与注释不再传播旧章节编码
  - 文档、代码、seed 对同一规则编号一致

### [P0-05 管理端人工补发稳定操作键](./p0/05-admin-manual-adjustment-operation-key.md)

- 开工条件：建议先完成 `P0-01`
- 预计改动模块：`apps/admin-api/app-user`、`libs/growth/growth-ledger`
- 预计影响文件：
  - `apps/admin-api/src/modules/app-user/app-user.service.ts`
  - `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
  - `apps/admin-api/src/modules/app-user/app-user.controller.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 核心测试点：
  - 同一 `operationKey` 重试不会重复落账
  - DTO 校验拒绝空或非法 `operationKey`
  - 日志和账本能串起同一人工操作

## 3. Wave 2

### [P0-02 管理端举报处理模块](./p0/02-admin-report-review-module.md)

- 开工条件：建议先完成 `P0-01`
- 预计改动模块：`apps/admin-api/report`、`libs/interaction/report`
- 预计影响文件：
  - `apps/admin-api/src/modules/admin.module.ts`
  - `apps/admin-api/src/modules/report/` 下新模块、controller、dto
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/report/dto/report.dto.ts`
  - `db/schema/app/user-report.ts`
- 核心测试点：
  - 管理端分页、详情、处理接口可用
  - 状态只允许进入 `RESOLVED / REJECTED`
  - 已处理举报不能回滚到 `PENDING`

### [P0-04 主题审核通过奖励补发](./p0/04-topic-audit-reward-backfill.md)

- 开工条件：`P0-01`
- 预计改动模块：`apps/admin-api/forum/topic`、`libs/forum/topic`、`libs/growth`
- 预计影响文件：
  - `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
  - `apps/admin-api/src/modules/forum/topic/dto/forum-topic.dto.ts`
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 核心测试点：
  - `PENDING -> APPROVED` 首次补发奖励
  - 重复审核或重复提交不重复发奖
  - 补发失败不阻塞审核状态提交

## 4. Wave 3

### [P0-03 举报奖励切到裁决后结算](./p0/03-report-reward-after-judgement.md)

- 开工条件：`P0-02`
- 预计改动模块：`libs/interaction/report`、`libs/growth`
- 预计影响文件：
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/report/report-growth.service.ts`
  - `libs/growth/src/growth-rule.constant.ts`
  - `libs/growth/src/resolver/user-report.resolver.ts`
  - `db/seed/modules/app/domain.ts`
- 核心测试点：
  - 创建举报时不立即发奖
  - `RESOLVED` 触发 `REPORT_VALID`
  - `REJECTED` 触发 `REPORT_INVALID`
  - 同一举报重复处理不会重复发奖

## 5. Wave 4

### [P1-01 任务奖励配置契约收敛](./p1/01-reward-config-contract.md)

- 开工条件：建议先完成 `P0-01`
- 预计改动模块：`apps/admin-api/task`、`libs/growth/task`
- 预计影响文件：
  - `apps/admin-api/src/modules/task/dto/task.dto.ts`
  - `apps/admin-api/src/modules/task/task.controller.ts`
  - `libs/growth/src/task/dto/task.dto.ts`
  - `libs/growth/src/task/task.service.ts`
  - `db/schema/app/task.ts`
- 核心测试点：
  - 非法 `rewardConfig` 被拒绝
  - `badgeCodes` 不再被误导性接收
  - 负数、浮点数、非法字段的校验明确

### [P1-04 账本 DTO 解释力增强](./p1/04-ledger-dto-explainability.md)

- 开工条件：建议先完成 `P0-01`
- 预计改动模块：`apps/app-api/user`、`apps/admin-api/app-user`、`libs/growth/growth-ledger`
- 预计影响文件：
  - `apps/app-api/src/modules/user/dto/user-point.dto.ts`
  - `apps/app-api/src/modules/user/dto/user.dto.ts`
  - `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.types.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 核心测试点：
  - App / 管理端返回 `ruleType / bizKey / context`
  - `context` 只透出白名单字段
  - `sourceLabel` 或同类派生字段口径稳定

## 6. Wave 5

### [P1-03 任务奖励返回结构化结果](./p1/03-growth-reward-result.md)

- 开工条件：建议先完成 `P1-01`
- 预计改动模块：`libs/growth/growth-reward`、`libs/growth/task`
- 预计影响文件：
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
  - `libs/growth/src/task/task.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 核心测试点：
  - 成功、幂等命中、失败三类返回值可区分
  - 返回值能携带 point / experience 记录 ID
  - warning log 仍保留，但不是唯一输出

### [P1-02 `task_assignment` 奖励状态字段](./p1/02-task-assignment-reward-status.md)

- 开工条件：`P1-03`
- 预计改动模块：`db/schema/app`、`libs/growth/task`、`apps/app-api/task`、`apps/admin-api/task`
- 预计影响文件：
  - `db/schema/app/task-assignment.ts`
  - `libs/growth/src/task/task.service.ts`
  - `apps/app-api/src/modules/task/dto/task.dto.ts`
  - `apps/admin-api/src/modules/task/dto/task.dto.ts`
  - `apps/admin-api/src/modules/task/task.controller.ts`
- 核心测试点：
  - assignment 在成功、失败、幂等命中时状态正确
  - `rewardLedgerIds`、`lastRewardError` 回写准确
  - 自动完成与手动完成共用同一逻辑

## 7. Wave 6

### [P1-05 混合成长账本分页接口](./p1/05-mixed-growth-ledger-page.md)

- 开工条件：`P1-04`
- 预计改动模块：`apps/app-api/user`、`apps/admin-api/app-user`、`libs/growth/growth-ledger`
- 预计影响文件：
  - `apps/app-api/src/modules/user/user.controller.ts`
  - `apps/admin-api/src/modules/app-user/app-user.controller.ts`
  - `apps/app-api/src/modules/user/dto/user.dto.ts`
  - `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 核心测试点：
  - 新接口能混合返回积分与经验
  - 时间线排序稳定
  - 旧 points / experience 接口继续可用

## 8. Wave 7

### [P2-A-01 代码级 `EventDefinitionMap`](./p2a/01-event-definition-map.md)

- 开工条件：`P0-01`
- 预计改动模块：`libs/growth`
- 预计影响文件：
  - `libs/growth/src/event-definition/` 下新增 type、map、service
  - `libs/growth/src/growth-rule.constant.ts`
  - `libs/growth/src/index.ts` 或相关导出入口
- 核心测试点：
  - `getEventDefinition` / `listEventDefinitions` 返回稳定
  - 已实现与可配置标记正确
  - 旧编码不会重新进入事实源

### [P2-A-02 轻量 `EventEnvelope` 类型](./p2a/02-event-envelope.md)

- 开工条件：`P2-A-01`
- 预计改动模块：`libs/growth`、部分事件生产方
- 预计影响文件：
  - `libs/growth/src/event-definition/` 下新增 envelope type
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/growth/src/task/task.service.ts`
- 核心测试点：
  - 高频链路可生成统一事件壳
  - 不要求统一派发流程也能落地
  - envelope 字段最小集保持稳定

### [P2-A-03 文档与 DTO 统一引用事件定义](./p2a/03-doc-and-dto-alignment.md)

- 开工条件：`P2-A-01`
- 预计改动模块：`libs/growth`、`apps/admin-api`、`docs`
- 预计影响文件：
  - `libs/growth/src/point/dto/point-rule.dto.ts`
  - `libs/growth/src/point/dto/point-record.dto.ts`
  - `libs/growth/src/experience/dto/experience-rule.dto.ts`
  - `libs/growth/src/experience/dto/experience-record.dto.ts`
  - `apps/admin-api/src/modules/growth/experience/dto/experience.dto.ts`
  - `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
- 核心测试点：
  - 多处长枚举注释不再继续手写复制
  - DTO 展示口径与事件定义层一致
  - 新编码说明只维护一处

## 9. Wave 8

### [P2-B-01 通知模板](./p2b/01-notification-template.md)

- 开工条件：`P2-A-01`
- 预计改动模块：`db/schema/message`、`libs/message/notification`、`apps/admin-api/message`
- 预计影响文件：
  - `db/schema/message/notification-template.ts` 新文件
  - `db/relations/message.ts`
  - `libs/message/src/notification/notification.service.ts`
  - `apps/admin-api/src/modules/message/` 下新增模板 controller / dto / service
- 核心测试点：
  - 模板 CRUD 可用
  - 渲染失败有 fallback
  - 模板键与通知类型映射稳定

### [P2-B-02 用户通知偏好](./p2b/02-notification-preference.md)

- 开工条件：`P2-B-01`
- 预计改动模块：`db/schema/message`、`libs/message/notification`、`apps/app-api/message`
- 预计影响文件：
  - `db/schema/message/notification-preference.ts` 新文件
  - `apps/app-api/src/modules/message/message.controller.ts`
  - `apps/app-api/src/modules/message/dto/message.dto.ts`
  - `libs/message/src/notification/notification.service.ts`
- 核心测试点：
  - 获取 / 更新偏好接口可用
  - 关闭偏好后不再投递对应通知
  - 默认值策略明确且可回归

### [P2-B-03 通知投递结果表](./p2b/03-notification-delivery.md)

- 开工条件：`P2-B-01`
- 预计改动模块：`db/schema/message`、`libs/message/outbox`、`apps/admin-api/message`
- 预计影响文件：
  - `db/schema/message/notification-delivery.ts` 新文件
  - `libs/message/src/outbox/outbox.worker.ts`
  - `libs/message/src/outbox/outbox.service.ts`
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`
  - `apps/admin-api/src/modules/message/dto/message-monitor.dto.ts`
- 核心测试点：
  - 成功投递会写 delivery
  - 失败和重试会写明原因与次数
  - 管理端可查看 delivery 结果

### [P2-B-04 任务提醒与公告边界](./p2b/04-task-reminder-and-announcement-boundary.md)

- 开工条件：`P2-B-01`
- 预计改动模块：`libs/growth/task`、`libs/message`、`libs/app-content/announcement`、`apps/app-api/message`
- 预计影响文件：
  - `libs/growth/src/task/task.service.ts`
  - `libs/message/src/notification/notification.service.ts`
  - `libs/message/src/inbox/inbox.service.ts`
  - `libs/app-content/src/announcement/announcement.service.ts`
  - `db/schema/app/app-announcement-read.ts`
- 核心测试点：
  - 三类提醒场景使用稳定幂等键
  - 重要公告可进入通知或 inbox
  - 普通公告继续留在内容域
  - 未读统计不会重复计算

## 10. Wave 9

### [P2-C-01 治理闸门统一](./p2c/01-governance-gate-unification.md)

- 开工条件：`P0-01`、`P2-A-01`
- 预计改动模块：`libs/forum`、`libs/interaction/comment`、`libs/interaction/report`、`libs/message`、`libs/growth`
- 预计影响文件：
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/interaction/src/comment/comment-growth.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/growth/src/growth-rule.constant.ts`
  - `libs/message/src/notification/notification.service.ts`
- 核心测试点：
  - 主题、评论、举报的治理态口径一致
  - 未通过治理的内容不会错误进入奖励主链路
  - 待审核内容进入通知 / 待办的边界明确

### [P2-C-02 评论审核后台](./p2c/02-comment-moderation-admin.md)

- 开工条件：`P2-C-01`
- 预计改动模块：`apps/admin-api/comment`、`libs/interaction/comment`
- 预计影响文件：
  - `apps/admin-api/src/modules/comment/` 下新模块、controller、dto
  - `apps/admin-api/src/modules/admin.module.ts`
  - `libs/interaction/src/comment/` 下 service / dto / constant
  - `libs/interaction/src/comment/comment-growth.service.ts`
- 核心测试点：
  - 评论分页、审核、隐藏可用
  - 审核结果与奖励、通知、任务推进边界一致
  - 已审核评论不会被错误回滚

### [P2-C-03 `CHAT` outbox 域闭环](./p2c/03-chat-outbox-closure.md)

- 开工条件：`P2-B-03`
- 预计改动模块：`libs/message/outbox`、`libs/message/chat`、`db/schema/message`
- 预计影响文件：
  - `libs/message/src/outbox/outbox.worker.ts`
  - `libs/message/src/outbox/outbox.constant.ts`
  - `libs/message/src/chat/chat.service.ts`
  - `db/schema/message/message-outbox.ts`
  - `db/schema/message/chat-message.ts`
- 核心测试点：
  - `CHAT` 域记录可以被 worker 消费
  - 聊天 ack 与通知 ack 边界清楚
  - 若写 delivery，不会误用通知域语义

## 11. 最后建议

最适合直接开工的仍然是：

1. `P0-01`
2. `P0-05`
3. `P0-02`
4. `P0-04`
5. `P0-03`

因为这 5 个任务最直接决定后面所有奖励、治理、事件定义层的正确性基础。
