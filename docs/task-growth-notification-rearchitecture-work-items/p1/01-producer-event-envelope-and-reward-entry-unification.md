# P1-01 Producer 事件壳与奖励入口统一

## 1. 目标

把当前各业务 producer 在“事件表达、奖励入口、幂等上下文”上的分裂状态收口，给后续任务事件消费提供稳定输入。

本任务要解决的问题是：

- 同类业务事件不能再一部分走事件定义，一部分直接打账本；
- producer 不能各自发明一套 `bizKey / metadata / visibility` 语义；
- 任务系统未来要消费业务事件，必须拿到稳定且可复放的 envelope。

## 2. 范围

本任务覆盖以下模块与调用点：

- 事件定义：
  - `libs/growth/src/event-definition/event-definition.map.ts`
  - `libs/growth/src/event-definition/event-definition.service.ts`
  - `libs/growth/src/event-definition/event-envelope.type.ts`
- 奖励统一入口：
  - `libs/growth/src/growth-reward/growth-reward.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 当前 producer 代表实现：
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/comment/comment-growth.service.ts`
  - `libs/interaction/src/like/like-growth.service.ts`
  - `libs/interaction/src/favorite/favorite-growth.service.ts`
  - `libs/interaction/src/follow/follow-growth.service.ts`
  - `libs/interaction/src/browse-log/browse-log-growth.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/report/report-growth.service.ts`

## 3. 当前代码锚点

- `forum-topic.service.ts`、`report-growth.service.ts` 已能构造事件上下文并走 `tryRewardByRule()`，更接近目标态；
- `favorite-growth.service.ts`、`follow-growth.service.ts`、`browse-log-growth.service.ts`、`comment-growth.service.ts` 仍直接调用 `GrowthLedgerService.applyByRule()`；
- `event-definition.map.ts` 已声明大量事件消费者包含 `TASK`，但并没有统一的 producer 契约保证这些事件一定会被发出来；
- `eventEnvelope` 结构已经存在，但其正式语义是 `subjectId / operatorId / governanceStatus / context`，并未成为 producer 的硬性入口合同；
- `report.service.ts` 负责生成举报裁决 envelope，而不仅仅是 `report-growth.service.ts` 使用它：
  - `libs/interaction/src/report/report.service.ts`

## 4. 非目标

- 本任务不直接实现任务事件消费器；
- 不在本任务中重构所有业务模块内部领域模型；
- 不新增 Kafka、MQ 等独立消息基础设施；
- 不强制所有 producer 同一轮一次性切完，可允许兼容期适配；
- 不处理与成长无关的业务事件统一。

## 5. 主要改动

### 5.1 固定 producer 事件 envelope 最小合同

统一要求所有与成长/任务相关的 producer 输出稳定事件合同，分为两层：

1. 语义层：复用现有 `EventEnvelope`
2. 幂等层：通过桥接入口额外携带稳定 `bizKey`

`EventEnvelope` 最小字段至少包括：

- `code`
- `key`
- `subjectType`
- `subjectId`
- `targetId`
- `targetType`
- `operatorId`
- `occurredAt`
- `governanceStatus`
- `context`

其中：

- `subjectId/operatorId` 用于区分“奖励主体”和“操作者”；
- `governanceStatus/context` 用于控制内容被折叠、删除、审核失败时是否应奖励和计入任务；
- `bizKey` 不强塞进基础 envelope，而由统一桥接入口补充，用于奖励幂等与任务进度去重。

### 5.1.1 建立统一事件桥接入口

在 producer 与 `growth / task / notification` 之间新增桥接 facade，至少负责：

- 接收 `EventEnvelope + bizKey`
- 统一记录 consumer 维度的可消费判断
- 统一把事件分发给成长奖励、任务推进和通知链路
- 避免 producer 直接互调 `TaskService`

### 5.2 统一基础奖励入口

producer 原则上不直接调用 `GrowthLedgerService.applyByRule()`，统一走：

- `UserGrowthRewardService.tryRewardByRule()`

这样可统一：

- 积分和经验双资产发放；
- 统一日志与错误处理；
- 统一 `bizKey` 幂等；
- 后续附带任务消费埋点或事件重放能力。

### 5.3 建立 producer 迁移顺序

建议按影响面由高到低迁移：

1. `comment-growth.service.ts`
2. `like-growth.service.ts`
3. `favorite-growth.service.ts`
4. `follow-growth.service.ts`
5. `browse-log-growth.service.ts`

迁移原则：

- 先保行为一致，再切调用入口；
- 每迁移一个 producer，都要补一组“重复事件不重复奖励”的回归测试；
- 兼容期内允许 `GrowthLedgerService.applyByRule()` 只对底层服务开放，不对业务服务开放。

### 5.4 统一奖励上下文与错误语义

统一 producer 到奖励服务的入参结构，明确：

- 事件码
- 业务实体类型
- 业务实体 id
- `subjectId`
- `operatorId`
- 去重键
- `governanceStatus`
- `context`

并定义错误语义：

- 幂等命中不是错误；
- 规则未命中是可观察但非失败；
- 账本写入失败需要可重试并保留上下文。

### 5.5 建立任务消费前置保障

在任务模块接入事件消费前，producer 统一必须满足：

- 有稳定 `eventCode`；
- 有稳定 `bizKey`；
- 有明确 `governanceStatus/context` 语义；
- 事件 envelope 可通过测试或日志重放。

## 6. 完成标准

- 主要 producer 的成长奖励入口已收敛到 `tryRewardByRule()`；
- 事件 envelope 字段合同已固定并形成测试；
- producer 统一经由事件桥接入口输出 `EventEnvelope + bizKey`；
- 直接从业务层调用 `GrowthLedgerService.applyByRule()` 的路径被显式收敛或标记兼容期；
- 每个迁移 producer 均有：
  - 幂等测试
  - 可见性/治理测试
  - 奖励结果一致性测试
- 任务事件消费所需的输入合同已经稳定。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 事件 envelope 设计说明
- 成长奖励入口接入规范

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P1-01`；
- 直接前置：`P0-03`；
- 软前置：`P0-02`；
- 完成后主要解锁：`P1-02`。
