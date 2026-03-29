# 通知域契约说明

## 1. 文档目标

本文只定义通知域的跨任务公共契约，避免不同任务包各自引入不同口径。

它回答 4 个问题：

1. `announcement / notification / inbox / chat` 的事实源分别是什么
2. 第一阶段通知偏好按什么粒度控制
3. `notification_delivery` 需要记录哪些结果状态
4. 模板层和投递层各自负责什么、不负责什么

## 2. 事实源边界

### 2.1 用户侧通知读模型

- `user_notification` 是用户侧“站内通知”唯一读模型
- 任何希望进入消息中心通知列表的业务消息，都需要物化为 `user_notification`
- `MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT` 只表示“公告已经进入通知域”，不是公告表本身
- 待审核、未通过治理或仅处于治理中间态的内容，不进入用户侧通知主链路

### 2.2 收件箱事实源

- `inbox` 摘要与时间线第一阶段只汇总：
  - `user_notification`
  - chat 会话 / chat 消息最新态
- `inbox` 不直接读取 `app_announcement`
- 因此“重要公告进入 inbox”的实现方式必须是先转成 `user_notification`

### 2.3 公告内容域

- `app_announcement` 继续承担公告内容发布、展示、上下线管理
- `app_announcement_read` 只服务公告内容域已读，不直接参与通知未读数
- 普通公告继续留在内容域，不默认进入通知域
- 重要公告当前按“高优先级 / 置顶 / 弹窗”命中后，才会由公告服务物化为 `user_notification(type=SYSTEM_ANNOUNCEMENT)`

### 2.4 chat 域

- chat 与通知可以共用 outbox 底座
- chat 不复用 `user_notification` 作为主读模型
- chat 的 ack、未读、会话聚合语义继续由 chat 域自己维护
- 当前已落地 `CHAT/MESSAGE_CREATED` outbox 事件，用于承接消息落库后的 WS fanout 与 inbox 摘要同步
- chat 不写 `notification_delivery`；排障继续看 `message_outbox.status` 与 WS 监控指标
- `chat.send / chat.read` 的 ack 仍是 chat 域自己的请求确认，不与通知投递结果混用

### 2.5 通知 outbox 类型来源

- 通知域 outbox 以 `payload.type` 作为唯一通知类型事实源
- 兼容期允许调用方继续传 `eventType`，但必须与 `payload.type` 保持一致
- `message_outbox.eventType` 在写库时由 `payload.type` 派生
- 彻底删除通知 outbox 输入中的 `eventType` 需要同步迁移公告、任务提醒、关注、评论点赞等非论坛通知调用方，建议拆为独立的全仓清理任务

## 3. 第一阶段通知偏好粒度

第一阶段只允许按 `MessageNotificationTypeEnum` 控制偏好：

- `COMMENT_REPLY`
- `COMMENT_LIKE`
- `CONTENT_FAVORITE`
- `TOPIC_LIKE`
- `TOPIC_FAVORITE`
- `TOPIC_COMMENT`
- `USER_FOLLOW`
- `SYSTEM_ANNOUNCEMENT`
- `CHAT_MESSAGE`
- `TASK_REMINDER`

明确不做的事：

- 不按事件定义层 code 控制
- 不按模板 key 控制
- 不按短信 / 邮件 / push 等渠道控制

默认策略：

- 采用“显式配置覆盖默认值”
- 第一阶段默认值按通知类型维护，当前默认均为启用
- 若用户没有单独配置，投递层按默认值判断

落地约束：

- `notification_preference` 只保存显式覆盖项，不保存“与默认值相同”的冗余记录
- `create user_notification` 前必须先合并默认值与显式覆盖，再决定是否抑制

## 4. delivery 结果语义

`message_outbox.status` 只表示技术消费状态，不足以表达业务投递结果。

因此 `notification_delivery` 需要记录业务结果，建议至少覆盖：

- `DELIVERED`：已成功创建通知记录，或等价地完成该次业务投递
- `FAILED`：真实失败，且本次已终止
- `RETRYING`：本次失败，但仍会重试
- `SKIPPED_DUPLICATE`：幂等命中，不重复创建通知
- `SKIPPED_SELF`：自己给自己触发的通知，按规则跳过
- `SKIPPED_PREFERENCE`：命中用户偏好关闭，主动抑制投递

使用原则：

- delivery 记录的是“为什么用户最终有没有收到这次通知”
- outbox 记录的是“worker 是否消费了这条待处理事件”
- 跳过不是失败，必须能被运营侧区分出来

当前已落地的最小实现：

- `notification_delivery` 已作为独立事实表落地
- 通知 worker 在 `DELIVERED / SKIPPED_* / RETRYING / FAILED` 场景都会写入 delivery
- 管理端已提供 `admin/message/monitor/delivery/page` 用于按状态、通知类型、接收人、`bizKey`、`outboxId` 排障

## 5. 模板层职责

模板层是可选渲染层，不是统一执行中心。

模板层负责：

- 管理模板 key、启停状态、版本或更新时间
- 保持 `MessageNotificationTypeEnum -> templateKey` 的一对一稳定映射
- 根据输入 payload 渲染 title / content
- 渲染失败时回退到业务方提供的 fallback title / content

第一阶段当前约束：

- 每个 `MessageNotificationTypeEnum` 最多只维护一份站内通知模板
- 核心站内通知类型通过 seed 初始化默认模板，但业务方 fallback 文案仍然必须保留
- `SYSTEM_ANNOUNCEMENT` / `TASK_REMINDER` 默认模板直接消费 `payload.title`、`payload.content`
- `COMMENT_REPLY` 继续保持跨内容域的通用模板表达；`TOPIC_*` 只覆盖论坛主题场景

模板层不负责：

- 选择接收人
- 生成幂等键
- 判定是否命中偏好
- 代替业务模块构建完整 payload

## 6. 推荐落地顺序

`先固定边界与状态语义 -> 再补模板/偏好/delivery -> 最后接任务提醒与公告收口`

具体到 `P2-B`：

1. 先以本文固定边界
2. `P2-B-01`、`P2-B-02`、`P2-B-03` 可以围绕同一契约并行推进
3. `P2-B-04` 在偏好与 delivery 语义稳定后再落提醒与公告边界

## 7. 与其他文档的关系

- 论坛主题通知改造设计：见 `docs/forum-topic-notification-optimization-plan.md`
- 论坛主题通知执行拆分：见 `docs/forum-topic-notification-work-items/*`
- 事件定义层：见 `docs/event-registry-special-design.md`
