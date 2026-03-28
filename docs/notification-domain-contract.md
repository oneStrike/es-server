# 通知域契约说明

## 1. 文档目标

本文只定义通知域的跨任务公共契约，避免 `P2-B-01 ~ P2-B-04` 各自引入不同口径。

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

### 2.4 chat 域

- chat 与通知可以共用 outbox 底座
- chat 不复用 `user_notification` 作为主读模型
- chat 的 ack、未读、会话聚合语义继续由 chat 域自己维护

## 3. 第一阶段通知偏好粒度

第一阶段只允许按 `MessageNotificationTypeEnum` 控制偏好：

- `COMMENT_REPLY`
- `COMMENT_LIKE`
- `CONTENT_FAVORITE`
- `USER_FOLLOW`
- `SYSTEM_ANNOUNCEMENT`
- `CHAT_MESSAGE`

明确不做的事：

- 不按事件定义层 code 控制
- 不按模板 key 控制
- 不按短信 / 邮件 / push 等渠道控制

默认策略：

- 采用“显式配置覆盖默认值”
- 第一阶段默认值按通知类型维护
- 若用户没有单独配置，投递层按默认值判断

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

## 5. 模板层职责

模板层是可选渲染层，不是统一执行中心。

模板层负责：

- 管理模板 key、启停状态、版本或更新时间
- 根据输入 payload 渲染 title / content
- 渲染失败时回退到业务方提供的 fallback title / content

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

- 排期与依赖：见 `docs/task-growth-reward-work-items/execution-plan.md`
- 单任务执行细节：见 `docs/task-growth-reward-work-items/p2b/*`
- 事件定义层：见 `docs/event-registry-special-design.md`
