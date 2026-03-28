# P2 本地改进方案任务清单

## 1. 文档目标

P2 解决的是“模型层和基础设施层的长期演进问题”。

只有在 P0 和 P1 已经把当前错误口径和账本解释力修好之后，P2 才值得推进。否则很容易先做出一套看起来完整的新模型，但旧问题依旧存在。

P2 的重点是三件事：

1. 让事件成为真正的一等公民
2. 让通知成为独立领域，而不是零散接口集合
3. 让治理、奖励、通知、账本围绕统一事实流转

## 2. 前置条件

P2 建议在以下条件满足后再启动：

- P0 已完成举报裁决发奖、主题审核补发、人工补发幂等
- P1 已完成任务奖励结算审计、账本增强展示
- 运营侧已经接受新的奖励口径
- 团队有能力承接新增表、消息生产者和接口联调

## 3. 范围边界

### 3.1 本阶段纳入范围

- 统一事件模型
- 通知模板、偏好、投递结果建模
- 任务提醒链路
- 公告已读与消息域衔接
- 聊天 outbox 域闭环
- 通知生产者补齐
- 治理层事件闸门前置

### 3.2 视资源决定是否纳入

- 积分/经验规则彻底合表
- 事件实例表持久化
- 多渠道通知（短信/邮件/Push）

## 4. 当前问题与代码证据

### 4.1 事件枚举存在，但事件模型不存在

当前已经有覆盖广泛的 `GrowthRuleTypeEnum`：

- `libs/growth/src/growth-rule.constant.ts`

同时，不少业务 service 都已经在构造自己的 `bizKey/ruleType/context`：

- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/interaction/src/comment/comment-growth.service.ts`
- `libs/interaction/src/like/like-growth.service.ts`
- `libs/interaction/src/favorite/favorite-growth.service.ts`
- `libs/interaction/src/follow/follow-growth.service.ts`
- `libs/interaction/src/report/report-growth.service.ts`

但当前仍然缺少：

- 统一的事件元数据
- 统一的事件载荷结构
- 统一的治理结果状态

### 4.2 通知底座已存在，但还没有成为完整领域

现有能力：

- `user_notification`
- `message_outbox`
- App 端 notification / inbox / chat API
- 管理端 outbox / ws monitor API

对应文件：

- `db/schema/message/user-notification.ts`
- `db/schema/message/message-outbox.ts`
- `apps/app-api/src/modules/message/message.controller.ts`
- `apps/admin-api/src/modules/message/message.controller.ts`

缺失能力：

- 通知模板
- 用户通知偏好
- 渠道投递明细
- 任务提醒生产者
- 系统公告转消息链路
- 聊天 outbox 域消费闭环

### 4.3 公告已读表存在，但尚未真正进入消息域

仓内已有：

- `app_announcement`
- `app_announcement_read`

对应文件：

- `db/schema/app/app-announcement.ts`
- `db/schema/app/app-announcement-read.ts`

但目前更多还是公告内容能力，没有真正与：

- 用户通知列表
- inbox 摘要
- 已读未读聚合

形成统一口径。

### 4.4 治理层还没有统一前置

当前主题审核、敏感词、举报状态都已经存在，但业务链路里仍然是“各做各的”：

- 主题审核通过补发在 P0 才会接上
- 举报有效/无效在 P0 才会接上
- 评论审核后台仍然缺失
- 待审核内容是否触发通知/任务，目前没有统一规范

## 5. P2 目标状态

P2 完成后，预期达到以下状态：

1. 业务事件有统一元数据和统一载荷结构
2. 治理结果先定性，再决定是否进入任务/奖励/通知
3. 通知具备模板、偏好、路由、投递、读模型五个层次
4. 公告、站内信、任务提醒、聊天消息可以被明确区分但共享底层基础设施

## 6. 总体实施策略

P2 建议拆成三个子阶段：

### 6.1 P2-A：通知域补全

先补模板、偏好、投递明细和生产者覆盖。

### 6.2 P2-B：事件与治理收口

再把事件中心和治理闸门引入主链路。

### 6.3 P2-C：深度模型优化

最后再考虑规则合表、多渠道通知、事件实例表持久化等更重的重构。

## 7. 详细任务清单

### 7.1 P2-A 通知域补全

#### 7.1.1 新增通知模板表

推荐表：`notification_template`

建议字段：

- `id`
- `templateKey`
- `business`
- `eventCode`
- `titleTemplate`
- `bodyTemplate`
- `route`
- `channelMask`
- `isEnabled`
- `createdAt`
- `updatedAt`

任务清单：

- [ ] 新增 schema
- [ ] 新增管理端模板 CRUD
- [ ] 模板渲染规则落在 `libs/message`
- [ ] 模板渲染失败的 fallback 策略文档化

#### 7.1.2 新增通知偏好表

推荐表：`notification_preference`

建议字段：

- `userId`
- `systemEnabled`
- `taskEnabled`
- `socialEnabled`
- `marketingEnabled`
- `channelConfig`
- `updatedAt`

任务清单：

- [ ] 新增 schema
- [ ] App 端新增“获取偏好 / 更新偏好”接口
- [ ] 通知投递前接入偏好检查
- [ ] 明确默认值策略

#### 7.1.3 新增通知投递结果表

推荐表：`notification_delivery`

建议字段：

- `id`
- `outboxId`
- `channel`
- `provider`
- `providerMessageId`
- `status`
- `deliveredAt`
- `ackAt`
- `errorText`
- `createdAt`

任务清单：

- [ ] 新增 schema
- [ ] outbox worker 在投递后写 delivery
- [ ] 管理端可查看失败原因与重试次数
- [ ] 为后续短信/邮件/Push 预留渠道扩展位

#### 7.1.4 任务提醒接入通知链路

- [ ] 定义任务提醒触发点
- [ ] 明确触发场景：
  - 新任务可领
  - 任务即将过期
  - 任务完成奖励到账
- [ ] 增加对应通知模板
- [ ] 使用稳定幂等键，避免重复提醒

涉及模块：

- `libs/growth/src/task/*`
- `libs/message/src/outbox/*`
- `libs/message/src/notification/*`

#### 7.1.5 公告与消息域衔接

- [ ] 明确公告是否进入 inbox
- [ ] 如果进入 inbox，为公告生成 `SYSTEM_ANNOUNCEMENT` 类型通知
- [ ] 将 `app_announcement_read` 与用户未读统计衔接
- [ ] 设计“只记公告已读，不污染通知列表”与“同时进入通知列表”两种模式
- [ ] 推荐先采用“重要公告进入通知列表，普通公告仅保留内容域”的双轨方案

### 7.2 P2-B 事件与治理收口

#### 7.2.1 新增事件元数据模型

推荐表：`event_type`

建议字段：

- `id`
- `code`
- `label`
- `business`
- `sourceType`
- `targetType`
- `isEnabled`
- `remark`

任务清单：

- [ ] 将 `GrowthRuleTypeEnum` 对应关系整理到 `event_type`
- [ ] 明确“声明存在”和“已经接入生产者”的状态字段
- [ ] 管理端提供事件字典只读查询

#### 7.2.2 统一事件载荷结构

推荐引入领域对象：`EventEnvelope`

建议字段：

- `eventCode`
- `actorId`
- `subjectType`
- `subjectId`
- `targetType`
- `targetId`
- `sceneType`
- `sceneId`
- `payload`
- `occurredAt`
- `validState`

任务清单：

- [ ] 在 `libs/*` 中定义统一 TS type
- [ ] 让高频生产者先接入：
  - 主题创建
  - 评论创建
  - 点赞/收藏/关注
  - 举报处理
  - 任务完成
- [ ] 奖励与通知从消费“业务动作”逐步转向消费“事件封装”

#### 7.2.3 治理闸门前置

- [ ] 定义 `validState`
  - `PENDING_REVIEW`
  - `APPROVED`
  - `REJECTED`
  - `HIDDEN`
- [ ] 规定只有 `APPROVED` 事件能进入奖励主链路
- [ ] 明确哪些 `PENDING_REVIEW` 事件可以进入“待办通知”链路
- [ ] 对评论、主题、举报统一收敛治理态口径

#### 7.2.4 评论审核后台

这是 P2 里非常值得补的一项治理能力。

任务清单：

- [ ] 新增评论审核管理端模块
- [ ] 支持评论分页、筛选、审核、隐藏
- [ ] 与评论奖励/通知生产链路对齐
- [ ] 明确评论待审核时是否允许触发任务进度

### 7.3 P2-C 深度模型优化

#### 7.3.1 聊天 outbox 域闭环

当前 `message_outbox` 已定义 `CHAT` 域，但 worker 只处理 `NOTIFICATION`。

任务清单：

- [ ] 为 `CHAT` 域补消费逻辑
- [ ] 明确聊天消息是否也写 delivery
- [ ] 明确聊天 ack 与通知 ack 的边界

涉及文件：

- `db/schema/message/message-outbox.ts`
- `libs/message/src/outbox/outbox.worker.ts`
- `libs/message/src/chat/*`

#### 7.3.2 通知生产者补齐

当前建议补齐的生产者包括：

- [ ] `SYSTEM_ANNOUNCEMENT`
- [ ] `CHAT_MESSAGE`
- [ ] `TASK_REMINDER`
- [ ] `TOPIC_COMMENT`
- [ ] 审核待办通知

#### 7.3.3 Growth 规则模型优化

这是可选重构项，不建议在 P2 前半段就做。

可选方向：

- [ ] 评估积分规则与经验规则是否合为统一 `growth_rule`
- [ ] 统一规则维度字段
- [ ] 用 `assetMask` 或多条规则映射替代双表镜像维护

前提：

- 团队接受较大迁移成本
- 已有规则配置量可控

## 8. 推荐文件与模块改动范围

### 8.1 预计新增表

- `event_type`
- `notification_template`
- `notification_preference`
- `notification_delivery`

视需要新增：

- `event_record`

### 8.2 预计重点改动模块

- `libs/message/*`
- `libs/growth/*`
- `libs/forum/*`
- `libs/interaction/*`
- `apps/app-api/src/modules/message/*`
- `apps/app-api/src/modules/system/*`
- `apps/admin-api/src/modules/message/*`
- `apps/admin-api/src/modules/forum/*`
- `db/schema/app/*`
- `db/schema/message/*`

## 9. 验收标准

### 9.1 事件层验收

- 团队可以明确说出“一个事件从哪里产生、被谁消费、经过什么治理态”
- 高频业务不再各自发明一套 `bizKey/context` 语义

### 9.2 通知层验收

- 通知有模板
- 用户有偏好
- outbox 有投递结果
- 公告/站内信/聊天/任务提醒边界清晰

### 9.3 治理层验收

- 审核/举报不再只是后台页面，而是主链路闸门
- 评论、主题、举报至少在模型层口径统一

## 10. 风险与注意事项

### 10.1 过早抽象风险

- 如果 P0/P1 没做完就上事件中心，很容易做成“概念很完整，现网问题一个没少”

### 10.2 通知域膨胀风险

- 模板、偏好、delivery、outbox、inbox、chat、ws 监控如果一次性全做，任务量会非常大
- 建议严格按 P2-A / P2-B / P2-C 推进

### 10.3 规则合表风险

- 积分/经验规则合表属于重构，不建议和通知域补全同时推进

## 11. 推荐拆分为本地开发任务

### 任务 A：通知域补全

- 模板
- 偏好
- delivery
- 任务提醒
- 公告接入消息域

### 任务 B：事件与治理收口

- `event_type`
- `EventEnvelope`
- 治理闸门
- 评论审核后台

### 任务 C：深度基础设施优化

- chat outbox 域
- 通知生产者补齐
- Growth 规则模型优化评估

