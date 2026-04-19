# Message Notification Repair Review

## Scope

本次覆盖消息通知链路 P1 + P2 修复项。

补充：

- 文档中涉及“通知未读数字段”的描述已被后续 breaking change 更新。
- 当前字段命名与示例以 [app-message-notification-unread.md](./app-message-notification-unread.md) 为准。

包含：

- `domain_event_dispatch` 批量 claim / hydration 优化
- `announcement` 通知扇出批量发布
- `task_reminder` 投递记录 typed 列与查询改造
- 通知驱动的 `inbox.summary.updated` 实时摘要降本
- `announcement.unpublished` 反查已通知用户改为 typed 列
- `inbox timeline` 改为数据库级合并分页
- `chat` 活跃成员索引优化
- `notification_delivery` / admin monitor 搜索索引与匹配语义调整
- 通知链路 actor 快照复用
- `openDirectConversation` 减少无效 upsert

## Breaking Changes

### 1. `inbox.summary.updated` 不再保证在“通知驱动更新”场景下返回完整聊天摘要

影响范围：

- WebSocket 事件：`inbox.summary.updated`
- 触发场景：
  - 新通知投递
  - 单条通知标记已读
  - 全部通知标记已读

旧行为：

- 每次通知变化都会同步回查整份 inbox summary
- payload 里通常同时带：
  - `notificationUnreadCount`
  - `chatUnreadCount`
  - `totalUnreadCount`
  - `latestNotification`
  - `latestChat`

新行为：

- 通知驱动的 summary 更新只保证：
  - `notificationUnread`
  - `chatUnreadCount`
  - `totalUnreadCount`
  - `latestNotification`
- `latestChat` 在这些场景下可能缺失，不再作为强保证字段返回

为什么允许 breaking：

- 旧行为在通知热路径上每次都要重算整份 summary，批量通知场景数据库读放大明显
- 本次修复优先保证投递吞吐和主链稳定性，不保留旧的“总是返回完整 summary”兼容层

### 前端必须做的改动

1. 处理 `inbox.summary.updated` 时，不要假设 `latestChat` 一定存在。
2. 如果前端本地已有聊天摘要缓存：
   - 当本次事件缺少 `latestChat` 时，保留当前缓存值，不要清空。
3. 如果前端需要强一致的最新聊天摘要：
   - 在必要场景主动调用 `GET app/message/inbox/summary` 重新拉取完整摘要。
4. 处理通知已读 / 新通知到达时：
   - 只用这次事件里的 `notificationUnread.total`、`notificationUnread.byCategory`、`chatUnreadCount`、`totalUnreadCount` 更新 badge / summary count
   - 不要把缺失的 `latestChat` 解释成“没有最新聊天”

### 2. 管理端 `projectionKey` 搜索改为精确匹配

影响范围：

- 通知投递记录查询
- 通知 dispatch 监控查询

旧行为：

- `projectionKey` 走模糊匹配

新行为：

- `projectionKey` 走精确匹配

为什么允许 breaking：

- 原模糊匹配没有可用索引支撑，日志表规模上来后查询成本不可控
- `projectionKey` 本身是稳定业务键，精确匹配更符合它的运维用途

### admin 前端必须做的改动

1. 若当前管理端在 `projectionKey` 搜索框中默认使用“关键字包含”心智，需要改成“完整键匹配”。
2. 若管理端有示例提示文案，应改为提示输入完整 `projectionKey`。
3. 若管理端需要保留模糊检索体验，应在 UI 层显式拆分为：
   - `projectionKey` 精确匹配
   - 其他更适合模糊检索的辅助筛选项

## Non-frontend Breaking Changes

以下变更属于后端 / 数据库内部破坏性治理，不要求前端适配：

### 2. `notification_delivery` 新增 task reminder typed 列

新增列：

- `task_id`
- `assignment_id`
- `reminder_kind`

说明：

- 任务提醒对账与运行态查询改为依赖 typed 列，不再依赖从 `domain_event.context` 里反查 JSON
- 这属于数据库与管理链路优化，对前端 contract 无直接影响
- 自本次修复起，`task_reminder` 写入必须同时带上 `task_id / assignment_id / reminder_kind`；旧 consumer 不再被兼容

### 3. `announcement` fanout 改为批量 domain event 发布

说明：

- 属于写路径优化
- 不改变 app/admin 对外接口合同

### 4. `domain_event_dispatch` 批量 claim 改为批量 hydration

说明：

- 属于内部调度优化
- 不改变对外 contract

### 5. `user_notification` 新增 `announcement_id` typed 列

说明：

- `announcement.unpublished` 反查已通知用户改为依赖 typed 列
- 属于数据库与后端内部查询治理，对 app/admin 对外 contract 无直接影响
- 自本次修复起，`system_announcement` 写入必须同时带上 `announcement_id`；未升级的旧 consumer 将直接写入失败

### 6. `inbox timeline` 改为数据库级合并分页

说明：

- 保持现有接口形态不变
- 属于读路径优化，对前端 contract 无直接影响

### 7. `chat` 打开会话逻辑减少无效 upsert

说明：

- 属于内部写路径优化
- 不改变 app/admin 对外 contract

### 8. 通知链路 actor 快照复用

说明：

- 属于内部读放大优化
- 不改变 app/admin 对外 contract

### 9. 后端部署不再支持消息通知链路的滚动兼容窗口

说明：

- 本次修复通过 typed 列强约束保证公告下线与任务提醒查询只读取新合同数据
- 数据库迁移完成后，旧版本消息通知 consumer 若继续写入旧格式记录，将直接违反约束并失败
- 部署时必须以“先完成迁移，再完成后端消费者升级，最后恢复相关写流量”为前提；不再支持混跑旧新两套通知写路径

## Risk Notes

- 如果前端当前把 `inbox.summary.updated` 当成“完整覆盖本地 inbox summary 状态”的唯一事实源，本次变更会导致聊天摘要被意外清空或覆盖。
- 前端若改为“计数字段增量更新 + latestChat 缺失时保留旧值”，则可以平滑承接本次变更。
- 如果管理端仍把 `projectionKey` 当模糊搜索使用，本次变更会表现为“搜索结果变少/搜不到”。
