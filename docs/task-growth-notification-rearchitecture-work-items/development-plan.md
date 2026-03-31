# Task / Growth / Notification 全链路重估开发补充

## 1. 文档目标

本文只补充开发执行信息，不重新定义排期。

本文重点回答：

1. 当前代码到底分成哪几层
2. 哪些模块已经稳定，哪些模块仍处于过渡态
3. 每个波次预计会改哪些文件、补哪些测试、注意哪些迁移点

## 2. 当前架构盘点

### 2.0 当前实施进度

1. `P0-01 ~ P0-04` 已完成并落到代码：
   - 任务类型已收敛为稳定场景；
   - 任务目标模型与 assignment 快照已补齐；
   - 基础奖励与任务 bonus 已通过 ledger `source` 区分；
   - 任务通知已收口为 `TASK_REMINDER + reminderKind`。
2. `P1-01 ~ P1-03` 已完成并已打通主路径：
   - producer 已统一走事件桥接入口；
   - 任务可消费真实业务事件推进；
   - App/Admin 读模型已共享统一的用户可见状态语义。
3. `P2-01` 与 `P2-03` 已完成：
   - 管理端现已支持按事件聚合查看 point / experience 基础奖励与关联任务；
   - 任务奖励/通知已有最小对账页与补偿入口。
4. `P2-02` 暂缓：
   - 当前实现尚未证明单表发布模型已经成为瓶颈；
   - 本轮不抢跑拆表，避免在没有真实收益时引入额外迁移和兼容成本。

### 2.1 Task 当前链路

当前 `task` 域主要由以下代码构成：

- 配置与发布：`apps/admin-api/src/modules/task/*` + `libs/growth/src/task/task.service.ts`
- App 入口：`apps/app-api/src/modules/task/*`
- 数据模型：`db/schema/app/task.ts`、`task-assignment.ts`、`task-progress-log.ts`

当前观察结论：

1. `task` 表仍同时承担“任务模板、发布实例、运营展示配置、奖励配置”四类职责，这是当前单表模型的主要剩余结构压力。
2. `task.type` 已收敛为稳定场景值，历史 `REPEAT / OPERATION` 仅通过兼容映射参与读取与筛选；`sourceTag / campaignId / displayGroup` 本轮未落地。
3. `task_assignment.taskSnapshot` 已冻结 `code/title/description/cover/type/repeatRule/claimMode/completeMode/objectiveType/eventCode/objectiveConfig/targetCount/rewardConfig/publishStartAt/publishEndAt` 等执行关键字段。
4. App 端 `getAvailableTasks()` 已只面向手动领取任务，`getMyTasks()` 围绕 assignment 读模型，并在读取前执行到期收口与 auto assignment 补建。
5. `TaskService.consumeEventProgress()` 已承接事件型任务推进；`task_progress_log` 现已记录 `eventCode / eventBizKey / progressSource / eventOccurredAt` 作为幂等与审计事实源。
6. `task.complete` 仍是任务域内部的自定义字符串事件壳，暂未纳入统一事件定义表。

### 2.2 基础奖励当前链路

当前基础奖励由三层组成：

1. 规则定义：
   - `db/schema/app/user-point-rule.ts`
   - `db/schema/app/user-experience-rule.ts`
2. 奖励协调：
   - `libs/growth/src/growth-reward/growth-reward.service.ts`
3. 统一落账：
   - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
   - `db/schema/app/growth-ledger-record.ts`

当前观察结论：

1. `GrowthLedgerService` 已经是积分/经验的统一事实源，负责幂等、限额、余额更新、等级同步和审计。
2. `UserGrowthRewardService.tryRewardByRule()` 已用于“基础行为奖励”，并返回结构化结果（`source / bizKey / dedupeResult / ledgerRecordIds`）。
3. `UserGrowthRewardService.tryRewardTaskComplete()` 已用于“任务 bonus 奖励”，并通过 `assignmentId + taskId + userId` 形成稳定补偿键。
4. `growth_ledger_record` 已新增稳定 `source` 字段，至少覆盖 `growth_rule / task_bonus` 两类来源，公开 DTO 也已同步透出。
5. 任务奖励结算与补偿已围绕 assignment 快照进行，`rewardStatus / rewardResultType / rewardLedgerIds / lastRewardError` 会与账本结果同步。
6. 点、经验规则仍保持分表，这一层当前没有必要合并；本轮重点已经转为“入口统一”和“运营认知统一”。

### 2.3 Notification 当前链路

当前通知链路由四层组成：

1. 入队：
   - `libs/message/src/outbox/outbox.service.ts`
2. 消费：
   - `libs/message/src/outbox/outbox.worker.ts`
3. 通知落库与偏好/模板：
   - `libs/message/src/notification/notification.service.ts`
   - `libs/message/src/notification/notification-template.service.ts`
   - `libs/message/src/notification/notification-preference.service.ts`
   - `libs/message/src/notification/notification-delivery.service.ts`
4. 用户侧实时与收件箱摘要：
   - `libs/message/src/notification/notification-realtime.service.ts`
   - `libs/message/src/inbox/inbox.service.ts`

当前观察结论：

1. `message_outbox` + `notification_delivery` 已经形成了较完整的技术状态与业务结果双视角。
2. `user_notification` 与 `inbox summary`、WebSocket 推送链路已经具备复用价值。
3. task 侧通知已通过 `TaskNotificationService` 收口 payload、文案和稳定 `bizKey`，`TaskService` 不再直接拼装三类提醒消息体。
4. 当前消息系统稳定的主类型仍是 `TASK_REMINDER`；`AVAILABLE / EXPIRING_SOON / REWARD_GRANTED` 已通过 `payload.reminderKind` 固定，并暴露到管理端查询层。
5. `notification_delivery` 仍未扩列 `taskId / assignmentId / reminderKind` 等稳定字段，当前任务维度过滤主要依赖 delivery 查询视图解析 outbox payload。

### 2.4 已抽样确认的 Producer 覆盖情况

| 模块 | 当前奖励入口 | 是否已有事件壳 | 任务 consumer 接线状态 | 备注 |
| --- | --- | --- | --- | --- |
| `forum-topic.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 发帖创建与审核补发共用稳定 `bizKey` |
| `comment.service.ts + comment-growth.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 评论链路继续受治理态闸门控制 |
| `like-growth.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 点赞与评论点赞已统一桥接入口 |
| `favorite-growth.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 收藏链路已补事件壳 |
| `follow-growth.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 一次关注会派发“关注”和“被关注”两类事件 |
| `browse-log-growth.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 浏览仍是高频事件，需继续关注写放大与节流 |
| `report.service.ts + report-growth.service.ts` | `GrowthEventBridgeService.dispatchDefinedEvent()` | 有 `createDefinedEventEnvelope()` | 已接线 | 仅裁决进入终态后才会进入奖励/任务主链路 |

### 2.5 当前主要架构问题

1. `task` 单表仍偏重，模板/发布/运营来源语义尚未真正分层。
2. `sourceTag / campaignId / displayGroup` 未纳入本轮，来源维度仍需在后续结构升级中明确。
3. `task.complete` 尚未并入统一事件定义层，任务域内部仍存在一条自定义事件语义。
4. `notification_delivery` 对任务维度过滤仍主要依赖查询视图解析 payload，而不是稳定结构字段。
5. 最终上线签收所需的运行、截图、压测和导出证据还未完全回填，当前“已完成”更多表示实现与主文档已收口，而不是最终上线已签收。

### 2.6 当前方案歧义与默认决议

以下问题若不先收口，后续实现很容易分叉：

1. 事件壳字段命名：
   - 默认以现有 `EventEnvelope(subjectId / operatorId / governanceStatus / context)` 为准；
   - `bizKey` 作为桥接层字段单独传递，不另造 `actorId / visibility / governanceContext / payload` 版本。
2. 事件任务周期归属：
   - 默认按 `eventEnvelope.occurredAt` 计算 `cycleKey`；
   - 仅在缺失时回退到消费时刻。
3. `EVENT_COUNT + MANUAL claimMode`：
   - 第一阶段默认不回补领取前事件；
   - 只在 assignment 创建后累计进度。
4. 任务通知类型策略：
   - 第一阶段保持 `TASK_REMINDER` 主类型；
   - 通过 `payload.reminderKind` 固定 `AVAILABLE / EXPIRING_SOON / REWARD_GRANTED` 三种子语义。
5. 治理反转回滚：
   - 第一阶段不做自动回滚；
   - 只要求保留审计、查询和人工修复入口。

## 3. 目标改造原则

1. `task` 只负责“运营任务包装、assignment、bonus 奖励、任务提醒”。
2. `GrowthRuleTypeEnum + point/experience rule + GrowthLedger` 继续负责“基础行为奖励”。
3. 事件定义层是任务和基础奖励共享的事实源，producer 必须逐步向它收口。
4. 先做兼容式增量演进，优先用“新增字段 + 文档收口 + 读写双兼容”方式推进。

## 4. Wave 1 开发补充

### [P0-01 任务域职责边界与类型语义收敛](./p0/01-task-domain-boundary-and-type-semantics.md)

- 开工条件：无硬前置，可直接开工
- 预计改动模块：`libs/growth/task`、`apps/admin-api/task`、`apps/app-api/task`、`db/schema/app/task`
- 预计影响文件：
  - `libs/growth/src/task/task.constant.ts`
  - `libs/growth/src/task/task.type.ts`
  - `libs/growth/src/task/dto/task.dto.ts`
  - `apps/admin-api/src/modules/task/dto/task.dto.ts`
  - `apps/app-api/src/modules/task/dto/task.dto.ts`
  - `db/schema/app/task.ts`
  - `db/seed/modules/app/domain.ts`
- 核心测试点：
  - `task.type` 新语义不会和 `repeatRule` 重叠
  - 旧 seed / DTO 示例不会继续把“每日任务”写成“新手任务”
  - App/Admin 侧筛选和展示文案统一

### [P0-02 任务目标模型与发布合同收口](./p0/02-task-objective-model-and-publish-contract.md)

- 开工条件：`P0-01` 完成
- 预计改动模块：`libs/growth/task`、`libs/growth/event-definition`、`db/schema/app/task`、`db/schema/app/task-assignment`
- 预计影响文件：
  - `libs/growth/src/task/task.service.ts`
  - `libs/growth/src/task/task.type.ts`
  - `libs/growth/src/task/dto/task.dto.ts`
  - `apps/admin-api/src/modules/task/task.controller.ts`
  - `apps/app-api/src/modules/task/task.controller.ts`
  - `db/schema/app/task.ts`
  - `db/schema/app/task-assignment.ts`
  - `libs/growth/src/event-definition/event-definition.service.ts`
- 核心测试点：
  - `objectiveType / eventCode / objectiveConfig` 校验语义稳定
  - `available / my` 两类查询口径与新目标模型不冲突
  - snapshot 能冻结足够的执行关键字段
  - 不拆表前提下，发布窗口与 assignment 仍可解释
  - 事件任务按 `occurredAt` 而不是消费时刻落周期
  - `EVENT_COUNT + MANUAL` 不会回补领取前事件，接口口径清晰

### [P0-03 基础奖励与任务 Bonus 合同重估](./p0/03-task-reward-contract-and-settlement-boundary.md)

- 开工条件：`P0-01` 完成
- 预计改动模块：`libs/growth/growth-reward`、`libs/growth/growth-ledger`、`libs/growth/task`、`libs/growth/point`、`libs/growth/experience`
- 预计影响文件：
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.types.ts`
  - `libs/growth/src/task/task.service.ts`
  - `libs/growth/src/point/point.service.ts`
  - `libs/growth/src/experience/experience.service.ts`
  - `libs/growth/src/point/dto/point-record.dto.ts`
  - `libs/growth/src/experience/dto/experience-record.dto.ts`
  - `db/schema/app/growth-ledger-record.ts`
  - `apps/app-api/src/modules/user/user.service.ts`
- 核心测试点：
  - 基础奖励与 task bonus 可从 `source/bizKey/context` 明确区分
  - assignment 奖励状态与 ledger 结果一致
  - 旧链路兼容下不出现重复发奖
  - 用户中心统计与账本解释不受误伤
  - `tryRewardByRule()` 能返回统一的结构化结果，供 producer、补偿和观测复用

## 5. Wave 2 开发补充

### [P0-04 任务提醒与通知投递合同收口](./p0/04-task-notification-contract-and-delivery-observability.md)

- 开工条件：`P0-03` 完成
- 预计改动模块：`libs/growth/task`、`libs/message/outbox`、`libs/message/notification`、`apps/admin-api/message`
- 预计影响文件：
  - `libs/growth/src/task/task.service.ts`
  - `libs/message/src/outbox/outbox.service.ts`
  - `libs/message/src/outbox/outbox.worker.ts`
  - `libs/message/src/notification/notification.service.ts`
  - `libs/message/src/notification/notification.constant.ts`
  - `libs/message/src/notification/notification-template.service.ts`
  - `libs/message/src/notification/notification-delivery.service.ts`
  - `db/schema/message/notification-delivery.ts`
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`
- 核心测试点：
  - `TASK_REMINDER + payload.reminderKind` 合同稳定
  - delivery/监控能看出 `AVAILABLE / EXPIRING_SOON / REWARD_GRANTED`
  - 重复补偿不会重复通知
  - inbox summary / websocket 不会出现脏同步

### [P1-01 Producer 事件壳与奖励入口统一](./p1/01-producer-event-envelope-and-reward-entry-unification.md)

- 开工条件：`P0-03` 完成
- 预计改动模块：`libs/forum/topic`、`libs/interaction/comment`、`libs/interaction/like`、`libs/interaction/favorite`、`libs/interaction/follow`、`libs/interaction/browse-log`、`libs/interaction/report`
- 预计影响文件：
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/comment/comment-growth.service.ts`
  - `libs/interaction/src/like/like-growth.service.ts`
  - `libs/interaction/src/favorite/favorite-growth.service.ts`
  - `libs/interaction/src/follow/follow-growth.service.ts`
  - `libs/interaction/src/browse-log/browse-log-growth.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/report/report-growth.service.ts`
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
  - `libs/growth/src/event-definition/*`
- 核心测试点：
  - producer 奖励入口不再四散重复拼 `POINTS / EXPERIENCE`
  - 无 envelope 的链路补齐桥接后仍能保持幂等
  - 治理态事件不会提前进入 task / reward 主链路
  - producer 统一经由“事件桥接入口”输出 `EventEnvelope + bizKey`，而不是直接互调 task consumer

## 6. Wave 3 开发补充

### [P1-02 事件驱动任务推进最小实现](./p1/02-event-driven-task-progress-pipeline.md)

- 开工条件：`P0-02`、`P1-01` 完成
- 预计改动模块：`libs/growth/task`、`libs/growth/event-definition`、已接入的 producer 模块
- 预计影响文件：
  - `libs/growth/src/task/task.service.ts`
  - 新增 `libs/growth/src/task/task-event-consumer.service.ts`（或等价 facade）
  - `libs/growth/src/task/task.type.ts`
  - `libs/growth/src/task/task.module.ts`
  - `db/schema/app/task-progress-log.ts`
  - `libs/growth/src/event-definition/*`
  - 与任务目标映射相关的 producer 文件
- 核心测试点：
  - 已实现事件能自动推进 assignment
  - 重复事件不会多次累加同一任务进度
  - 审核/裁决前置事件只会在治理通过后推进
  - 手动任务仍保留兼容路径
  - 事件重复投递可通过 `eventCode + bizKey` 去重和回放
  - 事件延迟消费不会把进度写入错误周期

### [P1-03 App/Admin 任务读模型与运营视图收口](./p1/03-app-and-admin-task-read-model-cleanup.md)

- 开工条件：`P0-02` 完成
- 预计改动模块：`apps/app-api/task`、`apps/admin-api/task`、`libs/growth/task`
- 预计影响文件：
  - `apps/app-api/src/modules/task/task.controller.ts`
  - `apps/app-api/src/modules/task/dto/task.dto.ts`
  - `apps/admin-api/src/modules/task/task.controller.ts`
  - `apps/admin-api/src/modules/task/dto/task.dto.ts`
  - `libs/growth/src/task/task.service.ts`
- 核心测试点：
  - “可领取任务”与“我的任务”口径清晰
  - 新场景类型、目标类型、事件编码可被后台筛选
  - 删除或变更 live task 后，assignment 展示仍可解释
  - 用户端不会看到语义含糊的类型与状态

## 7. Wave 4 开发补充

### [P2-01 成长规则配置入口语义统一](./p2/01-growth-rule-admin-semantic-unification.md)

- 开工条件：`P0-03` 完成
- 预计改动模块：`libs/growth/point`、`libs/growth/experience`、`apps/admin-api/growth`
- 预计影响文件：
  - `libs/growth/src/point/*`
  - `libs/growth/src/experience/*`
  - `apps/admin-api/src/modules/growth/point/*`
  - `apps/admin-api/src/modules/growth/experience/*`
  - `libs/growth/src/event-definition/*`
- 核心测试点：
  - 管理端不再把 point / experience 当成两套完全无关的事件字典
  - `GrowthRuleTypeEnum` 展示、校验与解释一致
  - 不需要合表也能做到统一认知

### [P2-02 任务模板 / 发布 / campaign 拆分](./p2/02-task-template-publish-and-campaign-split.md)

- 开工条件：`P1-02`、`P1-03` 完成
- 预计改动模块：`libs/growth/task`、`db/schema/app/task*`、后台任务管理
- 预计影响文件：
  - `db/schema/app/task.ts`
  - 新增 `task_template / task_publish / task_campaign` 相关 schema（若进入实施）
  - `libs/growth/src/task/*`
  - `apps/admin-api/src/modules/task/*`
- 核心测试点：
  - 模板与发布实例拆分后不破坏 assignment 稳定性
  - 同模板多次发布的版本追踪清晰
  - campaign 维度能独立检索与上下线

### [P2-03 对账、监控与运营观察面补齐](./p2/03-growth-and-notification-reconciliation-observability.md)

- 开工条件：`P0-04` 完成
- 预计改动模块：`libs/growth/task`、`libs/growth/growth-ledger`、`libs/message/*`、`apps/admin-api/message`
- 预计影响文件：
  - `libs/growth/src/task/task.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
  - `libs/message/src/notification/notification-delivery.service.ts`
  - `apps/admin-api/src/modules/message/message-monitor.service.ts`
  - 新增对账脚本或后台查询服务
- 核心测试点：
  - assignment / ledger / outbox / notification_delivery 可做交叉对账
  - 运维能看出“奖励失败但通知成功”“奖励成功但提醒跳过”等差异
  - 关键失败链路能在管理端被过滤与复核

## 8. 迁移与发布注意项

1. 新字段优先采用 nullable + 双读双写方式落地，避免一次性清空旧接口。
2. 涉及 `task.type` 语义收口时，必须同时更新 seed、DTO 示例、后台筛选文案和 API 文档。
3. 事件驱动任务推进上线前，必须先通过 [event-task-mapping-checklist.md](./checklists/event-task-mapping-checklist.md)。
4. 若引入 snapshot 字段扩容或 publish/assignment backfill，需要提供可重复执行的数据脚本与回滚说明。

## 9. 维护规则

- 若只变排序、依赖和状态，改 [execution-plan.md](./execution-plan.md)
- 若只变单任务方案，改对应任务单
- 若只变验收口径，改 checklist
- 除首个任务外，每次开工前先复核上一任务的完成标准、测试证据和文档同步结果，再进入本任务实施
